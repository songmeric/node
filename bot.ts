import *  as Kakao from 'node-kakao';
import sizeOf from 'image-size';
import * as http from 'http';
import * as https from 'https';
import {
  DEMUX_L_UUID,
  DEMUX_L_NAME,
  DEMUX_L_EMAIL,
  DEMUX_L_PASSWORD,
  DEMUX_MOD_CLIENT_UUID,
  DEMUX_MOD_CLIENT_NAME,
  DEMUX_MOD_CLIENT_EMAIL,
  DEMUX_MOD_CLIENT_PASSWORD,
  BR_LISTENER_UUID,
  BR_LISTENER_NAME,
  BR_LISTENER_EMAIL,
  BR_LISTENER_PASSWORD,
  BR_CLIENT_1_UUID,
  BR_CLIENT_1_NAME,
  BR_CLIENT_1_EMAIL,
  BR_CLIENT_1_PASSWORD,
  BR_CLIENT_2_UUID,
  BR_CLIENT_2_NAME,
  BR_CLIENT_2_EMAIL,
  BR_CLIENT_2_PASSWORD,
} from './cred';

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
  nickname: string;
}

//credentials
const demuxListenerCred: LoginCredentials = {
  email: DEMUX_L_EMAIL,
  password: DEMUX_L_PASSWORD
};
const demuxModCred: LoginCredentials = {
  email: DEMUX_MOD_CLIENT_EMAIL,
  password: DEMUX_MOD_CLIENT_PASSWORD
}
const brListenerCred: LoginCredentials = {
  email: BR_LISTENER_EMAIL,
  password: BR_LISTENER_PASSWORD
}
const brClient1Cred: LoginCredentials = {
  email: BR_CLIENT_1_EMAIL,
  password: BR_CLIENT_1_PASSWORD
}
const brClient2Cred: LoginCredentials = {
  email: BR_CLIENT_2_EMAIL,
  password: BR_CLIENT_2_PASSWORD
}

//devices
const demuxListenerDevice: DeviceInfo = {
    uuid: DEMUX_L_UUID,
    name: DEMUX_L_NAME
}
const demuxModDevice: DeviceInfo = {
  uuid: DEMUX_MOD_CLIENT_UUID,
  name: DEMUX_MOD_CLIENT_NAME
}
const brListenerDevice: DeviceInfo = {
  uuid: BR_LISTENER_UUID,
  name: BR_LISTENER_NAME
}
const brClient1Device: DeviceInfo = {
  uuid: BR_CLIENT_1_UUID,
  name: BR_CLIENT_1_NAME
}
const brClient2Device: DeviceInfo = {
  uuid: BR_CLIENT_2_UUID,
  name: BR_CLIENT_2_NAME
}


//version
const version = {
  version: '3.4.7',
  appVersion: '3.4.7.3369'
};

//TalkClients
const DEMUX_LISTENER = new Kakao.TalkClient(version);
const DEMUX_MODERATOR_CLIENT = new Kakao.TalkClient(version);
const BR_LISTENER = new Kakao.TalkClient(version);
const BR_CLIENT_1 = new Kakao.TalkClient(version);
const BR_CLIENT_2 = new Kakao.TalkClient(version);

//Broadcast Source URL
const broadcastSourceChannelURL = "https://open.kakao.com/o/gY2b5aef";
//Broadcast client-channel pairs
const braodcastClientChannelPairs: BroadcastClientChannelPair[] = [
  { client: DEMUX_MODERATOR_CLIENT, url: "https://open.kakao.com/o/gKTu5aef" , nickname: "BR_CLIENT_1"},
  { client: DEMUX_LISTENER, url: "https://open.kakao.com/o/gAMI5aef", nickname: "BR_CLIENT_2"},
];

const demuxListenerURL = "https://open.kakao.com/o/gRJu4aef";
const demuxTargetURL = "https://open.kakao.com/o/ghlQ4aef";
const demuxSourceAdminUserId = "";
const demuxSourceMod1UserId = "";
const demuxSourceMod2UserId = "";

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

  const modMap: Map<string, Kakao.TalkClient> = new Map([
    // map source mod userId to target mod client
    ["8929106192850792273", DEMUX_MODERATOR_CLIENT],
    ["5832696160572157424", BR_LISTENER]
  ]);

  // Get the sender's userId as a string
  const senderUserId = sender.userId.toString();

  let targetClient: Kakao.TalkClient | undefined = undefined;

  // Check if the sender is an admin
  if (modMap.has(senderUserId)) {
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
    console.log("Sender is not a or moderator, chat will not be forwarded.");
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

async function joinOpenChat(link: string, target_client: Kakao.TalkClient, nickname:string) {  
  const data = await target_client.channelList.open.getJoinInfo(link);
  console.log('starting joinopenchat');
  console.log(data);
  if(!data.success) return console.log('[!] 오픈채팅방 정보를 불러올 수 없어요.');
  const a = await target_client.channelList.open.joinChannel({linkId:data.result.openLink.linkId}, {nickname : nickname ?? "123"});
  if(!a.success) return console.log(`[!] 채팅방에 입장하던 중 오류가 발생했어요.`);
  else return console.log(`[!] 성공적으로 입장했어요.`);
  return;
}

async function getChatRoom(client: Kakao.TalkClient, linkURL: string, nickname?: string): Promise<Kakao.TalkOpenChannel | null> {
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
        if(nickname) {
          await joinOpenChat(linkURL, client, nickname);
          console.log('OpenChatRoom not found, joined it!');
          const openChannels = client.channelList.open.getLinkChannelList(linkId);
          return openChannels[0];
        } else {
          await joinOpenChat(linkURL, client, '123');
          console.log('OpenChatRoom not found, joined it!');
          const openChannels = client.channelList.open.getLinkChannelList(linkId);
          return openChannels[0];
        }
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
    console.log('searching for',pair.url);
    const channel = await getChatRoom(pair.client, pair.url, pair.nickname);
    channel?.sendChat(pair.nickname + "WORKING");
    channels.push(channel);
  }
  return channels;
}


//EntryPoint
async function main() {
    
    const demux_listener_login = await client_login(demuxListenerCred, DEMUX_LISTENER, demuxListenerDevice);
    const demux_mod_login = await client_login(demuxModCred, DEMUX_MODERATOR_CLIENT,demuxModDevice);
    const demux_mod_2_login = await client_login(brListenerCred, BR_LISTENER, brListenerDevice);
    const br_listener_login = await client_login(brListenerCred, BR_LISTENER, brListenerDevice);
    const br_client_1_login = await client_login(demuxModCred, DEMUX_MODERATOR_CLIENT, demuxModDevice);
    const br_client_2_login = await client_login(demuxListenerCred, DEMUX_LISTENER, demuxListenerDevice);
    const login_completion_res = await Promise.all([
      demux_listener_login,
      demux_mod_login,
      demux_mod_2_login,
      br_listener_login,
      br_client_1_login,
      br_client_2_login,
    ]);
    const demux_listener_channel = await getChatRoom(DEMUX_LISTENER,demuxListenerURL,"DEMUX_LISTENER");
    const demux_mod_channel = await getChatRoom(DEMUX_MODERATOR_CLIENT, demuxTargetURL,"DEMUX_MOD_1");
    const demux_mod_2_channel = await getChatRoom(BR_LISTENER, demuxTargetURL,"DEMUX_MOD_2");
    demux_mod_channel?.sendChat('DEMUX MODERATOR WORKING');
    demux_mod_2_channel?.sendChat('DEMUX MODERATOR 2 WORKING');
    demux_listener_channel?.sendChat('DEMUX LISTENER WORKING');
    const br_listener_channel = await getChatRoom(BR_LISTENER, broadcastSourceChannelURL,"BR_LISTENER");
    const br_client_channels:(Kakao.TalkOpenChannel | null)[] = await bc_channel_objarray(braodcastClientChannelPairs);
    const br_valid_channels = br_client_channels.filter((channel) => channel !== null) as Kakao.TalkOpenChannel[];
    console.log('validchannels:',br_valid_channels, '\nallchannels:',br_client_channels);
    br_listener_channel?.sendChat('BR LISTENER WORKING');

    DEMUX_LISTENER.channelList.open.on('chat', async(data: Kakao.TalkChatData, channel: Kakao.TalkOpenChannel) => {
        const sender = data.getSenderInfo(channel);
        if (!sender) return;
        const channel_name = channel.getDisplayName();
        console.log('--------------------------------------------------------------\nChannel_Name: ',channel_name,'\nChannel_ID: ',channel.channelId, ": \n\n",data,'\n--------------------------------------------------------------')
        if(channel.channelId == demux_listener_channel?.channelId) {
          demux_chat(data, sender, demuxTargetURL);
        }
      });

    BR_LISTENER.channelList.open.on('chat', async(data: Kakao.TalkChatData, channel: Kakao.TalkOpenChannel) => {
        const sender = data.getSenderInfo(channel);
        if (!sender) return;
        if(br_listener_channel) {
          if(channel.channelId == br_listener_channel?.channelId) {
            broadcast_chat(data,br_valid_channels);
          }
        }
        
    });

}
main().then()
