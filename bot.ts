import *  as Kakao from 'node-kakao';
import sizeOf from 'image-size';
import * as http from 'http';
import * as https from 'https';

let DEVICE_UUID:string = 'ilwsOC74XaF1QDL4aqg50up4AQfCiaTssH3QkU7d6bY0351h5VztgHAOw0XAYCdhJQBkWu8ztVNY5CJqTSTB7w==';
let DEVICE_NAME:string = 'DESKTOP-72G9J6A';
let L_EMAIL:string = '01048330230';//'01080615820';//'01056490575';//'01084433988';
let L_PASSWORD:string = 'soo123!@';//'aawwxx5820';//'aawwxx5649';//'ssj48089749';
let C_EMAIL:string = '01080615820';
let C_PASSWORD:string = 'aawwxx5820';
let C_UUID:string = 'u1486eAuFKWKYGQohTVAIWBCwUvt9KO/RO1R1JrwkFuXbL7juMh7H/h6DLn+9sIZySgLrZEGtZvtEG8+sZOnMp==';
let C_NAME:string = 'DESKTOP-12415';
let EMAIL:string = 'jwsong914@gmail.com';//'01048330230';//'01080615820';//'01056490575';//'01084433988';//'01021329880';
let PASSWORD:string = 's940914kww';//'soo123!@';//'aawwxx5820';//'aawwxx5649';//'ssj48089749';//'people123!@';

interface LoginCredentials {
    email: string;
    password: string;
  }
interface DeviceInfo {
    uuid: string;
    name: string;
}

const listnerCred: LoginCredentials = {
  email: L_EMAIL,
  password: L_PASSWORD
};
const listnerDevice: DeviceInfo = {
    uuid: DEVICE_UUID,
    name: DEVICE_NAME
}
const clientCred: LoginCredentials = {
  email: EMAIL,
  password: PASSWORD
}
const clientDevice: DeviceInfo = {
  uuid: C_UUID,
  name: C_NAME
}
const version = {
  version: '3.4.7',
  appVersion: '3.4.7.3369'
};

const LISTENER = new Kakao.TalkClient(version);
const CLIENT = new Kakao.TalkClient(version);
//CLIENT_1.on('chat', (data,channel)=> {
  //console.log(data)
  //if(data.text.includes('테스트')) {
    //joinOpenChat(channel, "https://open.kakao.com/o/gpMD9Kbf", );
    
  //}
  //if (data.text.startsWith("!실프 ")) { //오픈아이디 넣기
   // const num = bson.Long.fromString(data.text.slice(4)).toString(2).length - 29;
   //let num2 = bson.Long.fromInt(Number("0b" + bson.Long.fromString(data.text.slice(4)).toString(2).slice(num))).toString()     
    //channel.sendChat(num2);
 //}

//});





//Async Functions
async function forward_chat(from_channel: Kakao.TalkOpenChannel, to_channel: Kakao.TalkOpenChannel | Kakao.TalkNormalChannel, data_to_pack: Kakao.TalkChatData){
    const content = await build_chat(from_channel, data_to_pack);
    if(content instanceof Buffer) { //if image
        const template = {
            name: 'photo',
            data: content,
            width: sizeOf(content).width,
            height: sizeOf(content).height
        }
        to_channel.sendMedia(Kakao.KnownChatType.PHOTO,template);
    }
    else { //if not image
        if(content.type){
            to_channel.sendChat(content);
    }
  }
}

async function demux_chat(){

}

async function build_chat(channel: Kakao.TalkOpenChannel, data: Kakao.TalkChatData): Promise<Buffer | Kakao.Chat> { //add functionality to handle files and videos later
    const chatBuilder = new Kakao.ChatBuilder();
    let chat: Kakao.Chat = {
        type: 0, // Use an appropriate default type value
        text: '',
        attachment: {},
    }
    switch (data.chat.type) {
        case 1:
            chat = chatBuilder.text(data.text).build(Kakao.KnownChatType.TEXT);
            break;
        case 2:
            const at = data.chat.attachment;
            if (at && at.url) {
                try {
                    // Download the image
                    const urlString = at.url as string;
                    console.log('Image downloading, urlstring:', urlString);

                    const buffer = await new Promise<Buffer>((resolve, reject) => {
                        const httpRequest = urlString.startsWith('https') ? https : http;

                        httpRequest.get(urlString, (response) => {
                            if (response.statusCode !== 200) {
                                reject(new Error(`Failed to download image. Status Code: ${response.statusCode}`));
                                return;
                            }

                            const chunks: Uint8Array[] = [];
                            response.on('data', (chunk) => {
                                chunks.push(chunk);
                            });

                            response.on('end', () => {
                                const buffer = Buffer.concat(chunks);
                                resolve(buffer);
                            });
                        }).on('error', (error) => {
                            reject(error);
                        });
                    });
                    return buffer;
                    /*
                    console.log('response no issue');
                    // Upload the image using Kakao.AttachmentApi.upload()
                    const attachRes = await Kakao.AttachmentApi.upload(Kakao.KnownChatType.PHOTO, 'image', buffer);
                    if (attachRes.success && attachRes.result) {
                        const path = attachRes.result.path;
                        const url = new URL(urlString);
                        const protocol = url.protocol;
                        const hostname = url.hostname;
                        const port = url.port ? `:${url.port}` : '';
                        const baseURL = `${protocol}//${hostname}${port}`;
                        const imageAttach = {
                            url: baseURL + path,
                        }
                        chat = chatBuilder.text('photo').attachment(attachRes.result).attachment(imageAttach).build(Kakao.KnownChatType.PHOTO)
                        console.log('attach no issue');
                    }
                    else {
                        channel.sendChat('Kakao AttachmentApi 업로드가 실패 했습니다');
                    }
                    */
                    // Handle the uploaded image response (attatchRes) as needed
                }   catch (error) {
                        console.error('Error in catch:', error);
                    }
            }
            break;
    }
    return chat;
}

async function joinOpenChat(link: string, target_client: Kakao.TalkClient) {  
  const data = await target_client.channelList.open.getJoinInfo(link);
  console.log('starting joinopenchat');
  console.log(data);
  if(!data.success) return console.log('[!] 오픈채팅방 정보를 불러올 수 없어요.');
  const a = await target_client.channelList.open.joinChannel({linkId:data.result.openLink.linkId}, {nickname : '123'});
  if(!a.success) return console.log(`[!] 채팅방에 입장하던 중 오류가 발생했어요.`);
  else return console.log(`[!] 성공적으로 입장했어요.`);
  return;
}

async function getChatRoom(client: Kakao.TalkClient, linkURL: string): Promise<Kakao.TalkOpenChannel | null> {
    const joinInfoResult = await client.channelList.open.getJoinInfo(linkURL);
    if (!joinInfoResult.success) {
      console.error("Failed to get join info:", joinInfoResult.status);
      return null;
    }
    const linkId = joinInfoResult.result.openLink.linkId;
    const openChannels = client.channelList.open.getLinkChannelList(linkId);
  
    if (openChannels.length > 0) {
      console.log('OpenChatRoom found');
      return openChannels[0]; // Return the first available open channel with the given linkId
    } 
    else {
      try {
        await joinOpenChat(linkURL, client);
        console.log('OpenChatRoom not found, joined it!');
        const openChannels = client.channelList.open.getLinkChannelList(linkId);
        return openChannels[0];
      } catch (error) {
        console.error('OpenChatRoom not found, error while joining:', error);
        return null;
      }
    }
  }
  

async function updateOpenChat(channel: any, link: any, settings: any, target_client: Kakao.TalkClient) {
    const data = await target_client.channelList.open.getJoinInfo(link);
    console.log(data);
    if(!data.success) return channel.sendChat('[!] 오픈채팅방 정보를 불러올 수 없어요.');
    const a = await target_client.channelList.open.updateOpenLink({linkId:data.result.openLink.linkId},settings);
    return channel.sendChat('Update Success');
}

async function client_login(credentials: LoginCredentials, login_client: Kakao.TalkClient, device_info: DeviceInfo) {
    const api = await Kakao.AuthApiClient.create(device_info.name, device_info.uuid,version);
    const loginRes = await api.login(
      credentials,true
    );
    if (!loginRes.success) throw new Error(`Web login failed with status: ${loginRes.status}`);
  
    console.log(`Received access token: ${loginRes.result.accessToken}`);
  
    const res = await login_client.login(loginRes.result);
    if (!res.success) throw new Error(`Login failed with status: ${res.status}`);
  
    console.log('Login success');
    //console.log('List of OpenChatChannels: ')
    //console.log(Array.from(login_client.channelList.open.all()));

}



//EntryPoint
async function main() {
    const listen = await client_login(listnerCred, LISTENER, listnerDevice);
    const client_1 = await client_login(clientCred, CLIENT, clientDevice);
    const login_completion_res = await Promise.all([listen,client_1]);
    const listener_channel = await getChatRoom(LISTENER,"https://open.kakao.com/o/gNsd6Mdf");
    const client_channel = await CLIENT.channelList.normal.get(new Kakao.Long("368422921588209"));
    console.log(await CLIENT.channelList.open.getJoinInfo("https://open.kakao.com/o/gNsd6Mdf"));
    client_channel?.sendChat('CLIENT WORKING');
    listener_channel?.sendChat('LISTENER WORKING');

    LISTENER.channelList.open.on('chat', async(data: Kakao.TalkChatData, channel: Kakao.TalkOpenChannel) => {
        const sender = data.getSenderInfo(channel);
        if (!sender) return;
        //joinOpenChat(channel, "https://open.kakao.com/o/gI8THDdf", LISTENER);
        const channel_name = channel.getDisplayName();
        console.log('--------------------------------------------------------------\nChannel_Name: ',channel_name,'\nChannel_ID: ',channel.channelId, ": \n\n",data,'\n--------------------------------------------------------------')
        //forward_chat(channel, channel, data);
        if(client_channel){
            forward_chat(channel,client_channel,data)
        }
      });

}
main().then()
