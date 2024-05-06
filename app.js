const { AccessToken2 } = require("./src/lib/AccessToken2");
const express = require("express");
const bodyParser = require('body-parser');
const crc32 = require("crc-32");
const UINT32 = require("cuint").UINT32;

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// REST API
app.use(bodyParser.json());
app.post('/v1/tokenization', (req, res) => { 
    const token = req.body.token;
    const parseToken = toDictonary(token);
    res.json(parseToken);
});

app.get("/process/:text", (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    const token = req.params.text;
    const tokenization = toDictonary(token);

    res.json({ tokenData: tokenization});
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

function tokenFromString(originToken) {
    const versions = ["006", "007"];
    const VERSION_LENGTH = 3;
    const APP_ID_LENGTH = 32;
    const crc_channel_name = crc32.str(originToken.substr(VERSION_LENGTH, APP_ID_LENGTH));
    try {
      const originVersion = originToken.substr(0, VERSION_LENGTH);
      if (!versions.includes(originVersion) || originToken.length < 37) {
        return false;
      }
      const appID = originToken.substr(VERSION_LENGTH, APP_ID_LENGTH);
      const originContent = originToken.substr(VERSION_LENGTH + APP_ID_LENGTH);
      const originContentDecodedBuf = Buffer.from(originContent, "base64");
      const content = unPackContent(originContentDecodedBuf);
      const crc_uid = content.crc_uid;
      const m = content.m;
      const msgs = unPackMessages(m);
      const ts = msgs.ts;
      const messages = msgs.messages;
      const role = Object.keys(messages).length > 1 ? "Host" : "Audience";
      const tokenType = messages[1] ? "RTC" : messages[1000] ? "RTM" : false;
      if (!tokenType) return false;
      const uids = reverseCRC32(crc_uid, tokenType);
      const returnObj = {
        appId: appID,
        createdOn: (ts - 86400) * 1000,
        expiresOn: messages[tokenType === "RTC" ? 1 : 1000] * 1000,
        role,
        tokenType,
        uid: uids,
      };
      if (crc_channel_name === content.crc_channel_name) {
        returnObj.isChannelValid = true;
      }
      return returnObj;
    } catch (err) {
      console.log(err);
      return false;
    }
  }
  
  function ReadByteBuf(bytes) {
    const that = {
      buffer: bytes,
      position: 0,
    };
    that.getUint16 = function() {
      const ret = that.buffer.readUInt16LE(that.position);
      that.position += 2;
      return ret;
    };
    that.getUint32 = function() {
      const ret = that.buffer.readUInt32LE(that.position);
      that.position += 4;
      return ret;
    };
    that.getString = function() {
      const len = that.getUint16();
      const out = Buffer.alloc(len);
      that.buffer.copy(out, 0, that.position, that.position + len);
      that.position += len;
      return out;
    };
    that.getTreeMapUInt32 = function() {
      const map = {};
      const len = that.getUint16();
      for (var i = 0; i < len; i++) {
        var key = that.getUint16();
        var value = that.getUint32();
        map[key] = value;
      }
      return map;
    };
    return that;
  }
  
  function AccessTokenContent(options) {
    return {
      pack: () => {
        const out = new ByteBuf();
        out.putString(options.signature);
        out.putUint32(options.crc_channel_name);
        out.putUint32(options.crc_uid);
        out.putString(options.m);
        return out.pack();
      },
      ...options,
    };
  }
  
  function Message(options) {
    return {
      pack: () => {
        const out = new ByteBuf();
        out.putUint32(options.salt);
        out.putUint32(options.ts);
        out.putTreeMapUInt32(options.messages);
        return out.pack();
      },
      ...options,
    };
  }
  
  function unPackContent(bytes) {
    const readbuf = new ReadByteBuf(bytes);
    return AccessTokenContent({
      signature: readbuf.getString(),
      crc_channel_name: readbuf.getUint32(),
      crc_uid: readbuf.getUint32(),
      m: readbuf.getString(),
    });
  }
  
  function unPackMessages(bytes) {
    const readbuf = new ReadByteBuf(bytes);
    return Message({
      salt: readbuf.getUint32(),
      ts: readbuf.getUint32(),
      messages: readbuf.getTreeMapUInt32(),
    });
  }

  function reverseCRC32(parseID, tokenType) {
    if (tokenType == 'RTC'){
      for (let i = 0; i < 4294967296; i++) {
        if (crc32.str(String(i)) >>> 0 === parseID) {
          return i;
        }
      }
    }
    return "Unknown";
  }

function toDictonary(token){
  let payload = {};
  let createdOn, expiresOn, tokenType;
  let accessToken = null;
  
  if (tokenVersion(token) || token.startsWith("007")) {
    if (token.startsWith("007")) {
      let serviceMap = new Map([
        [1, "RTC"],
        [2, "RTM"],
        [4, "FPA"],
        [5, "Chat"],
        [7, "Education"],
      ]);
    }
    try {
      if (tokenVersion(token)){
        accessToken = tokenFromString(token);
      }else{
        accessToken = new AccessToken2("", "", 0, 300);
        accessToken.from_string(token);
      }
      payload.appId = (`${accessToken.appId}`);
      createdOn = tokenVersion(token) ? accessToken.createdOn : accessToken.issueTs * 1000;
      expiresOn = tokenVersion(token) ? accessToken.expiresOn : (accessToken.issueTs + accessToken.expire) * 1000;
      tokenType = tokenVersion(token) ? accessToken.tokenType : Object.keys(accessToken.services);
    } catch (error) {
      console.log(`Invalid Token Format`);
    }

    const serviceData = serviceTypes(tokenType, accessToken);

    if (serviceData.channelName) { payload.channel = serviceData.channelName; }

    const createdFormatted = formatDateAndTime(createdOn);
    const expiresFormatted = formatDateAndTime(limitExpiration(createdOn, expiresOn));
   
    payload.creation = createdFormatted;
    payload.expiration = tokenValidityCheck(createdOn, expiresOn) ? expiresFormatted : "Invalid Token Expiration";

    payload.serviceType = tokenVersion(token) ? (`${tokenType}`) : serviceData.serviceType;

    payload.role = tokenVersion(token) ? accessToken.role : "";
    if (serviceData.role) { payload.role = serviceData.role; }

    // payload.uid = tokenVersion(token) ? parseInt(accessToken.uid) : parseInt(serviceData.accountUID);
    payload.uid = tokenVersion(token) ? accessToken.uid : serviceData.accountUID;

    validty = checkValidity(createdOn, expiresOn);
    payload.valid = (validty <= 0) ? "Expired" : formatSeconds(validty);

    return payload;
  } else {
    console.log(`Invalid Token`);
    return "Invalid Token Format"
  }
}

function serviceTypes(service, accessToken) {
  const serviceData = {
    serviceType: "",
    channelName: "",
    accountUID: "",
    privileges: {},
    role: ""
  };

  switch (parseInt(service)) {
    case 1:
      serviceData.serviceType = "RTC";
      serviceData.channelName = accessToken.services['1']?.__channel_name?.toString() || "";
      serviceData.accountUID = accessToken.services['1']?.__uid?.toString() || "Any";
      serviceData.privileges = accessToken.services['1']?.__privileges || {};
      serviceData.role = Object.keys(serviceData.privileges).length > 1 ? "Host" : "Audience";
      break;
    case 2:
      serviceData.serviceType = "RTM";
      serviceData.accountUID = accessToken.services['2']?.__user_id?.toString() || "";
      break;
    case 4:
      serviceData.serviceType = "FPA";
      break;
    case 5:
      serviceData.serviceType = "CHAT";
      serviceData.accountUID = accessToken.services['5']?.__user_id?.toString() || "Any";
      break;
    case 7:
      serviceData.serviceType = "Education";
      break;
    default:
      serviceData.serviceType = "Unknown Service";
  }
  return serviceData;
}

function tokenVersion(token) {
  return token.startsWith("006");
}

function tokenValidityCheck(createdOn, expiresOn) {
  return createdOn < expiresOn;
}

function checkValidity(createdOn, expiresOn) {
  const maxValidity = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const isValidNow = createdOn < now && expiresOn > now;
  
  if (!isValidNow) { return 0; }
  const expirationTime = Math.min(expiresOn - createdOn, maxValidity);
  const expiresIn = Math.floor((expirationTime - (now - createdOn)) / 1000);
  
  return expiresIn > 0 ? expiresIn : 0;
}

function limitExpiration(createdDate, expirationDate) {
  const createdTime = new Date(createdDate).getTime();
  const maxExpirationTime = createdTime + (24 * 60 * 60 * 1000);
  return new Date(Math.max(createdTime, Math.min(new Date(expirationDate).getTime(), maxExpirationTime)));
}

function formatSeconds(seconds) {
  const timeUnits = [
    { label: "D", divisor: 24 * 3600 },
    { label: "H", divisor: 3600 },
    { label: "M", divisor: 60 },
    { label: "S", divisor: 1 }
  ];

  let formattedTime = timeUnits.map(({ label, divisor }) => {
      const value = Math.floor(seconds / divisor);
      seconds %= divisor;
      return value > 0 ? `${value}${label}` : "";
    })
    .filter(Boolean)
    .join(" ");

  return formattedTime || "";
}

function formatDateAndTime(dateTimeString) {
  const UTCDate = new Date(dateTimeString).toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: true,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const [date, time] = UTCDate.split(', ').map(str => str.trim());
  const swappedDateTimeString = `${date} ${time}`;
  return swappedDateTimeString;
}
