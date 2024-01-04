const crc32 = require("crc-32");
const UINT32 = require("cuint").UINT32;
const versions = ["006", "007"];
const VERSION_LENGTH = 3;
const APP_ID_LENGTH = 32;

// function createUint32Array(value) {
//   const uint32Array = new Uint32Array(1);
//   uint32Array[0] = value >>> 0;
//   return uint32Array;
// }

// async function crc32(data) {
//   const buffer = new TextEncoder().encode(data);
//   const hashBuffer = await crypto.subtle.digest('CRC-32', buffer);
//   const hashArray = Array.from(new Uint8Array(hashBuffer));
//   return hashArray.reduce((acc, byte) => acc * 256 + byte, 0);
// }

module.exports.tokenFromString = function (
  originToken,
  channelName = null,
  uid = null
) {
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
    let uidHash = UINT32(crc32.str(this.crc_uid)).and(UINT32(0xffffffff)).toNumber();
    returnObj = {
      ...returnObj,
      isUidValid: uidHash === content.crc_uid || content.crc_uid === 0,
    };
  }

  let returnObj = {
    appId: this.appID,
    createdOn: (this.ts - 86400) * 1000,
    expiresOn: msgs.messages[tokenType === "RTC" ? 1 : 1000] * 1000,
    role,
    tokenType,
    channelName: this.crc_channel_name,
    uid: UINT32(crc32.str(this.crc_uid)).and(UINT32(0xffffffff)).toNumber()
  };
  return returnObj;
};

var ReadByteBuf = function (bytes) {
  var that = {
    buffer: bytes,
    position: 0,
  };

  that.getUint16 = function () {
    var ret = that.buffer.readUInt16LE(that.position);
    that.position += 2;
    return ret;
  };

  that.getUint32 = function () {
    var ret = that.buffer.readUInt32LE(that.position);
    that.position += 4;
    return ret;
  };

  that.getString = function () {
    var len = that.getUint16();

    var out = Buffer.alloc(len);
    that.buffer.copy(out, 0, that.position, that.position + len);
    that.position += len;
    return out;
  };

  that.getTreeMapUInt32 = function () {
    var map = {};
    var len = that.getUint16();
    for (var i = 0; i < len; i++) {
      var key = that.getUint16();
      var value = that.getUint32();
      map[key] = value;
    }
    return map;
  };

  return that;
};
var AccessTokenContent = function (options) {
  options.pack = function () {
    var out = new ByteBuf();
    return out
      .putString(options.signature)
      .putUint32(options.crc_channel)
      .putUint32(options.crc_uid)
      .putString(options.m)
      .pack();
  };

  return options;
};

var Message = function (options) {
  options.pack = function () {
    var out = new ByteBuf();
    var val = out
      .putUint32(options.salt)
      .putUint32(options.ts)
      .putTreeMapUInt32(options.messages)
      .pack();
    return val;
  };

  return options;
};

var unPackContent = function (bytes) {
  var readbuf = new ReadByteBuf(bytes);
  return AccessTokenContent({
    signature: readbuf.getString(),
    crc_channel_name: readbuf.getUint32(),
    crc_uid: readbuf.getUint32(),
    m: readbuf.getString(),
  });
};

var unPackMessages = function (bytes) {
  var readbuf = new ReadByteBuf(bytes);
  return Message({
    salt: readbuf.getUint32(),
    ts: readbuf.getUint32(),
    messages: readbuf.getTreeMapUInt32(),
  });
};
