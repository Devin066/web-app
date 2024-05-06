const crc32 = require("crc-32");
const UINT32 = require("cuint").UINT32;

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
      const role = Object.keys(messages).length > 1 ? "Publisher" : "Subscriber";
      const tokenType = messages[1] ? "RTC" : messages[1000] ? "RTM" : false;
      if (!tokenType) return false;
      const uids = reverseCRC32(crc_uid);
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

  function reverseCRC32(parseID) {
    for (let i = 0; i < 4294967296; i++) {
      if (crc32.str(String(i)) >>> 0 === parseID) {
        return i;
      }
    }
    return "Unknown";
  }
  
  const token = "006b2656396d43b4fd984f93865f98a6a2fIADRPMVYM0qBTOfdYI4ntomLERv/ZccHICi2gMW4AVOioZgneRMAAAAAEAD70doCpLo2ZgEA6AOhujZm";
  const accessToken = tokenFromString(token);
  console.log(accessToken);