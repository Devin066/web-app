const { AccessToken2 } = require("./src/lib/AccessToken2");

const express = require("express");

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
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

tokenFromString = function(originToken, channelName = null, uid = null) {
  const versions = ["006", "007"];
  const VERSION_LENGTH = 3;
  const APP_ID_LENGTH = 32;

  try {
    originVersion = originToken.substr(0, VERSION_LENGTH);
    if (!versions.includes(originVersion) || originToken.length < 37) {
      return false;
    }
    this.appID = originToken.substr(VERSION_LENGTH, APP_ID_LENGTH);
    var originContent = originToken.substr(VERSION_LENGTH + APP_ID_LENGTH);
    var originContentDecodedBuf = Buffer.from(originContent, "base64");

    var content = unPackContent(originContentDecodedBuf);
    this.signature = content.signature;
    this.crc_channel_name = content.crc_channel_name;
    this.crc_uid = content.crc_uid;
    this.m = content.m;

    var msgs = unPackMessages(this.m);
    this.salt = msgs.salt;
    this.ts = msgs.ts;
    this.messages = msgs.messages;
  } catch (err) {
    console.log(err);
    return false;
  }
  const role =
    Object.keys(msgs.messages).length > 1 ? "Publisher" : "Subscriber";
  const tokenType = msgs.messages[1] ? "RTC" : msgs.messages[1000] ? "RTM" : false;
  if (!tokenType) return false;

  let returnObj = {
    appId: this.appID,
    createdOn: (this.ts - 86400) * 1000,
    expiresOn: msgs.messages[tokenType === "RTC" ? 1 : 1000] * 1000,
    role,
    tokenType,
  };
  if (channelName) {
    let channelNameHash = UINT32(crc32.str(channelName))
      .and(UINT32(0xffffffff))
      .toNumber();
    returnObj = {
      ...returnObj,
      isChannelValid: channelNameHash === content.crc_channel_name,
    };
  }
  if (uid) {
    let uidHash = UINT32(crc32.str(uid)).and(UINT32(0xffffffff)).toNumber();
    returnObj = {
      ...returnObj,
      isUidValid: uidHash === content.crc_uid || content.crc_uid === 0,
    };
  }
  return returnObj;
};

const ReadByteBuf = function(bytes) {
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
};

const AccessTokenContent = (options) => ({
  pack: () => {
    const out = new ByteBuf();
    return out
      .putString(options.signature)
      .putUint32(options.crc_channel)
      .putUint32(options.crc_uid)
      .putString(options.m)
      .pack();
  },
  ...options,
});

const Message = (options) => ({
  pack: () => {
    const out = new ByteBuf();
    const val = out
      .putUint32(options.salt)
      .putUint32(options.ts)
      .putTreeMapUInt32(options.messages)
      .pack();
    return val;
  },
  ...options,
});

const unPackContent = (bytes) => {
  const readbuf = new ReadByteBuf(bytes);
  return AccessTokenContent({
    signature: readbuf.getString(),
    crc_channel_name: readbuf.getUint32(),
    crc_uid: readbuf.getUint32(),
    m: readbuf.getString(),
  });
};

const unPackMessages = (bytes) => {
  const readbuf = new ReadByteBuf(bytes);
  return Message({
    salt: readbuf.getUint32(),
    ts: readbuf.getUint32(),
    messages: readbuf.getTreeMapUInt32(),
  });
};


function toDictonary(token){
  let payload = {};
  let appId, createdOn, expiresOn, tokenType;
  let accessToken = null;
  
  if (tokenVersion(token) || token.startsWith("007") || token != null) {
    let serviceMap;
    if (token.startsWith("007")) {
      serviceMap = new Map([
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

      appId = accessToken.appId;
    
      createdOn = tokenVersion(token) ? accessToken.createdOn : accessToken.issueTs * 1000;
      expiresOn = tokenVersion(token) ? accessToken.expiresOn : (accessToken.issueTs + accessToken.expire) * 1000;
      tokenType = tokenVersion(token) ? accessToken.tokenType : Object.keys(accessToken.services);

      payload.appId = (`${appId}`);
      
    } catch (error) {
      console.log(`Invalid Token Format`);
      process.exit(1);
    }

    validty = checkValidity(createdOn, expiresOn);
    
    const createdOnUtc = new Date(createdOn).toLocaleString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const createdFormatted = formatDateAndTime(createdOnUtc);

    actualExpiration = limitExpiration(createdOn, expiresOn);
    const expiresOnUtc = new Date(actualExpiration).toLocaleString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const expiresFormatted = formatDateAndTime(expiresOnUtc);

    payload.creation = createdFormatted;
    payload.expiration = expiresFormatted;

    payload.valid = (validty <= 0) ? "Expired" : formatSeconds(validty);

    const serviceData = serviceTypes(tokenType, accessToken);
    payload.serviceType = tokenVersion(token) ? (`${tokenType}`) : serviceData.serviceType;
    
    if (serviceData.channelName) {
      payload.channel = serviceData.channelName;
    }
    if (serviceData.accountUID) {
      payload.uid = serviceData.accountUID;
    }
    payload.role = tokenVersion(token) ? accessToken.role : "";
    if (serviceData.role) {
      payload.role = serviceData.role;
    }
    
  } else {
    console.log(`Invalid Token`);
    process.exit(1);
  }
  return payload;
}

function serviceTypes(service, accessToken) {
  let serviceData = {
    serviceType: "",
    channelName: "",
    accountUID: "",
    privileges: {},
    role: ""
  };

  switch (parseInt(service)) {
    case 1:
      serviceData.serviceType = "RTC";
      serviceData.channelName = accessToken.services['1'].__channel_name.toString();

      const checkAccountUID = accessToken.services['1'].__uid.toString();
      serviceData.accountUID = checkAccountUID === "" ? "Any" : checkAccountUID;

      serviceData.privileges = accessToken.services['1'].__privileges;
      serviceData.role = Object.keys(serviceData.privileges).length > 1 ? "Host" : "Audience";
      break;
    case 2:
      serviceData.serviceType = "RTM";
      serviceData.accountUID = accessToken.services['2'].__user_id.toString();
      break;
    case 4:
      serviceData.serviceType = "FPA";
      break;
    case 5:
      serviceData.serviceType = "CHAT";
      const checkChatAccountUID = accessToken.services['5'].__user_id.toString();
      serviceData.accountUID = checkChatAccountUID === "" ? "Any" : checkChatAccountUID;
      break;
    case 7:
      serviceData.serviceType = "Education";
      break;
    default:
      serviceData.serviceType = "Invalid Service";
  }

  return serviceData;
}

function tokenVersion(token) {
  return token.startsWith("006");
}

function checkValidity(createdOn, expiresOn) {
  const maxValidity = 24 * 60 * 60 * 1000;
  const expirationTime = Math.min(expiresOn - createdOn, maxValidity);
  const now = new Date().getTime();
  const isValidNow = createdOn < now && expiresOn > now;
  const expiresIn = isValidNow ? Math.floor((expirationTime - (now - createdOn)) / 1000) : 0;
  return expiresIn;
}

function formatDateAndTime(dateTimeString) {
  const [date, time] = dateTimeString.split(', ').map(str => str.trim());
  const swappedDateTimeString = `${date} ${time}`;
  return swappedDateTimeString;
}

function limitExpiration(createdDate, expirationDate) {
  // Convert createdDate and expirationDate to milliseconds
  const createdTime = new Date(createdDate).getTime();
  let expirationTime = new Date(expirationDate).getTime();

  // Calculate the maximum allowed expiration time (24 hours)
  const maxExpirationTime = createdTime + (24 * 60 * 60 * 1000);

  // Limit expiration time to the maximum allowed time, but not less than the created time
  expirationTime = Math.max(createdTime, Math.min(expirationTime, maxExpirationTime));

  // Return the limited expiration date
  return new Date(expirationTime);
}


function formatSeconds(seconds) {
  const units = ["D", "H", "M", "S"];
  const divisors = [24 * 3600, 3600, 60, 1];

  let formattedTime = units.map((unit, index) => {
      const value = Math.floor(seconds / divisors[index]);
      seconds %= divisors[index];
      return value !== 0 ? `${value}${unit}` : "";
    })
    .filter(Boolean)
    .join(" ");
  return formattedTime || "";
}


