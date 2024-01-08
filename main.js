const { tokenFromString } = require("./src/lib/AccessToken");
const { AccessToken2 } = require("./src/lib/AccessToken2");

const token1 = "007eJxTYPixuuRP4QG5dcqW1sIP/MMMPnnfzDhncrakbvndMNkTs/0VGJKMzEzNjC3NUkyMk0zSUiwtTNIsjS3MTNMsLRLNEo3Sdm5uTp0hysTAsE6TlZGBkYEFiAX4GBiYwCQzmGQBk9wMIanFJc4ZiXl5qTkMDABr5yHm"
const token2 = "006b2656396d43b4fd984f93865f98a6a2fIADq5yAzQIut/Tx4Jg+8N9wm+9SK80qOv8Y4DHEeNunBP5gneRMAAAAAEABJ024AEg+FZQEA6APQ+IVl"

const [tokenA, channel, userid] = process.argv.slice(2);
let token = (tokenA != null) ? tokenA : (token1 != null) ? token1 : token2;

const jsonPayload = toDictonary(token);
console.log(JSON.stringify(jsonPayload, null, 2));

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
        accessToken = tokenFromString(token, channel, userid)
        // console.log(accessToken)
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
      console.log(`Invalid Token`);
      process.exit(1);
    }

    validty = checkValidity(createdOn, expiresOn);
    
    payload.creation = createdOn;
    payload.expiration = expiresOn;
    payload.valid = (validty <= 0) ? "Expired" : validty;

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

function formatDate(date) {
  const formattedDate = date;
  return formattedDate.replace(',', '');
};

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
