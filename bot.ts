import *  as Kakao from 'node-kakao';
import sizeOf from 'image-size';
import * as http from 'http';
import * as https from 'https';

let DEMUX_L_UUID:string = 'iU28atbi/7lH0I1/HmE1m3WZIY7rfjLSzrMubQT0OynYDf8EPAkTeZ2EcKSu/bi5Oc503fQSa9cEO7K3EY3OIi==';
let DEMUX_L_NAME:string = 'DESKTOP-TWOWAA';
let DEMUX_L_EMAIL:string = '01048330230';
let DEMUX_L_PASSWORD:string = 'soo123!@';

let DEMUX_ADMIN_CLIENT_UUID:string = 'hKDgNHpyHo5wUoIqQljd/VU7roHHJtjADYR9B4+yCUKuBOZCwDaLxxMDruaKwi9VZA7En8xjCCim3LvE1iPYeg==';
let DEMUX_ADMIN_CLIENT_NAME:string = 'DESKTOP-AMAAMA';
let DEMUX_ADMIN_CLIENT_EMAIL:string = '01084433988';
let DEMUX_ADMIN_CLIENT_PASSWORD:string = 'ssj48089749';

//interface
interface LoginCredentials {
    email: string;
    password: string;
  }
interface DeviceInfo {
    uuid: string;
    name: string;
}
interface BroadcastClientChannelPair {
  client: Kakao.TalkClient;
  url: string;
}

//credentials
const listenerCred: LoginCredentials = {
  email: DEMUX_L_EMAIL,
  password: DEMUX_L_PASSWORD
};

const clientCred: LoginCredentials = {
  email: DEMUX_ADMIN_CLIENT_EMAIL,
  password: DEMUX_ADMIN_CLIENT_PASSWORD
}

//devices
const listenerDevice: DeviceInfo = {
    uuid: DEMUX_L_UUID,
    name: DEMUX_L_NAME
}
const clientDevice: DeviceInfo = {
  uuid: DEMUX_ADMIN_CLIENT_UUID,
  name: DEMUX_ADMIN_CLIENT_NAME
}

//version
const version = {
  version: '3.4.7',
  appVersion: '3.4.7.3369'
};

//TalkClients
const DEMUX_LISTENER = new Kakao.TalkClient(version);
const DEMUX_ADMIN_CLIENT = new Kakao.TalkClient(version);
const DEMUX_MODERATOR_CLIENT_1 = new Kakao.TalkClient(version);
const DEMUX_MODERATOR_CLIENT_2 = new Kakao.TalkClient(version);
const BR_LISTENER = new Kakao.TalkClient(version);
const BR_CLIENT_1 = new Kakao.TalkClient(version);
const BR_CLIENT_2 = new Kakao.TalkClient(version);

//Broadcast Source URL
const broadcastSourceChannelURL = "";
//Broadcast client-channel pairs
const braodcastClientChannelPairs: BroadcastClientChannelPair[] = [
  { client: BR_CLIENT_1, url: "https://open.kakao.com/o/gChannel1URL" },
  { client: BR_CLIENT_2, url: "https://open.kakao.com/o/gChannel2URL" },
];

//Async Functions
async function broadcast_chat(
  data: Kakao.TalkChatData,
  destinations: Kakao.TalkOpenChannel | Kakao.TalkNormalChannel | (Kakao.TalkOpenChannel | Kakao.TalkNormalChannel)[]
) {
  const content = await build_chat(data);
  const targetChatrooms = Array.isArray(destinations) ? destinations : [destinations];

  for (const destination of targetChatrooms) {
    if (content instanceof Buffer) { // if image
      const template = {
        name: 'photo',
        data: content,
        width: sizeOf(content).width,
        height: sizeOf(content).height
      }
      destination.sendMedia(Kakao.KnownChatType.PHOTO, template);
    } else { // if not image
      if (content.type) {
        destination.sendChat(content);
      }
    }
  }
}

//demultiplexer
async function demux_chat(
  data: Kakao.TalkChatData,
  sender: any,
  targetChannelURL: string
) {
  const adminMap: Map<string, Kakao.TalkClient> = new Map([
    // map source admin userId to target admin client
    ["5271640832072849254", DEMUX_ADMIN_CLIENT],
  ]);

  const modMap: Map<string, Kakao.TalkClient> = new Map([
    // map source mod userId to target mod client
    ["182", DEMUX_MODERATOR_CLIENT_1],
    ["321", DEMUX_MODERATOR_CLIENT_2]
  ]);

  // Get the sender's userId as a string
  const senderUserId = sender.userId.toString();

  let targetClient: Kakao.TalkClient | undefined = undefined;

  // Check if the sender is an admin
  if (adminMap.has(senderUserId)) {
    targetClient = adminMap.get(senderUserId);
    console.log('admin map success');
  } else if (modMap.has(senderUserId)) {
    // Check if the sender is a moderator
    targetClient = modMap.get(senderUserId);
  }

  if (targetClient) {
    // Get the target chatroom
    const target_channel = await getChatRoom(targetClient, targetChannelURL);

    if (target_channel) {
      // Forward the chat to the target chatroom using the appropriate account client
      broadcast_chat(data, target_channel);
    } else {
      console.error("Failed to get the target channel.");
    }
  } else {
    console.log("Sender is not an admin or moderator, chat will not be forwarded.");
    console.log(senderUserId);
  }
}





async function build_chat(data: Kakao.TalkChatData): Promise<Buffer | Kakao.Chat> { //add functionality to handle files and videos later
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

//create array of broadcast channel objects using broadcastTargetChannelURLs
async function bc_channel_objarray(pairs: BroadcastClientChannelPair[]): Promise<(Kakao.TalkOpenChannel | null)[]> {
  const channels: (Kakao.TalkOpenChannel | null)[] = [];
  for (const pair of pairs) {
    const channel = await getChatRoom(pair.client, pair.url);
    channels.push(channel);
  }
  return channels;
}


//EntryPoint
async function main() {
    
    const listener_login = await client_login(listenerCred, DEMUX_LISTENER, listenerDevice);
    const admin_client_login = await client_login(clientCred, DEMUX_ADMIN_CLIENT, clientDevice);
    const login_completion_res = await Promise.all([listener_login,admin_client_login]);
    const listener_channel = await getChatRoom(DEMUX_LISTENER,"https://open.kakao.com/o/gkeKZPdf");
    const client_channel_URL = "https://open.kakao.com/o/gCJSZPdf";
    const client_channel_conn_test = await getChatRoom(DEMUX_ADMIN_CLIENT,client_channel_URL);
    client_channel_conn_test?.sendChat('ADMIN_CLIENT WORKING');
    listener_channel?.sendChat('LISTENER WORKING');


    DEMUX_LISTENER.channelList.open.on('chat', async(data: Kakao.TalkChatData, channel: Kakao.TalkOpenChannel) => {
        const sender = data.getSenderInfo(channel);
        if (!sender) return;
        //joinOpenChat(channel, "https://open.kakao.com/o/gI8THDdf", LISTENER);
        const channel_name = channel.getDisplayName();
        console.log('--------------------------------------------------------------\nChannel_Name: ',channel_name,'\nChannel_ID: ',channel.channelId, ": \n\n",data,'\n--------------------------------------------------------------')
        //forward_chat(channel, channel, data);
        if(client_channel_conn_test){
          demux_chat(data,sender,client_channel_URL);
        }
      });

    BR_LISTENER.channelList.open.on('chat', async(data: Kakao.TalkChatData, channel: Kakao.TalkOpenChannel) => {
        const sender = data.getSenderInfo(channel);
        if (!sender) return;
        const target_array:(Kakao.TalkOpenChannel | null)[] = await bc_channel_objarray(braodcastClientChannelPairs);
        const valid_channels = target_array.filter((channel) => channel !== null) as Kakao.TalkOpenChannel[];
        broadcast_chat(data,valid_channels);
    });

}
main().then()
