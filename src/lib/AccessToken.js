const crc32 = require("crc-32");
const UINT32 = require("cuint").UINT32;

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
    // console.log(originContent);
    var content = unPackContent(originContentDecodedBuf);
    this.signature = content.signature;
    this.crc_channel_name = content.crc_channel_name;
    this.crc_uid = content.crc_uid;
    this.m = content.m;


    var msgs = unPackMessages(this.m);
    this.salt = msgs.salt;
    this.ts = msgs.ts;
    this.messages = msgs.messages;
    // console.log(this.ts);
  } catch (err) {
    // console.log(err);
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
    uid: this.crc_uid,
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

// const token = "006b2656396d43b4fd984f93865f98a6a2fIADRPMVYM0qBTOfdYI4ntomLERv/ZccHICi2gMW4AVOioZgneRMAAAAAEAD70doCpLo2ZgEA6AOhujZm"; // RTM
const token = "006b2656396d43b4fd984f93865f98a6a2fIAA8eYS9pW69Bcxt70weB/qdsAl8+6Wt3EP1yAUxnX93vgx+f9jK7BWTIgCDZn0Eobw2ZgQAAQAgxTJmAgAgxTJmAwAgxTJmBAAgxTJm"; // RTC
let channel = null;
let userid = null;
accessToken = tokenFromString(token, channel, userid);
console.log(accessToken);

uidSample = "99929"
parseID = UINT32(crc32.str(uidSample)).and(UINT32(0xffffffff)).toNumber();
// console.log(parseID);

function reverseCRC32(parseID) {
  for (let i = 0; i < 4294967296; i++) {
      let tryUID =  UINT32(crc32.str(String(i))).and(UINT32(0xffffffff)).toNumber();
      if (tryUID === parseID) {
          return i;
      }
  }
  return "Unknown";
}

