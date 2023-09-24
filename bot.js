import OpenAI from 'openai';
import mineflayer from 'mineflayer';
import ACCOUNT from './ACCOUNT.json' assert { type: 'json' };
import IP from './IP.json' assert { type: 'json' };
import 'dotenv/config';
import * as fs from 'fs';
import { format } from 'date-fns';
// const {
// 	pathfinder,
// 	Movements,
// 	goals: { GoalNear, GoalFollow },
// } = require('mineflayer-pathfinder');
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
const { GoalNear, GoalFollow } = goals;

const chatHistory = [];

// Check if the state file exists
if (!fs.existsSync('log.json')) {
	// If not, create and initialize it with an empty array
	fs.writeFileSync('log.json', '[]', 'utf8');
}

// Check if the state file exists
if (!fs.existsSync('chatHistory.json')) {
	// If not, create and initialize it with an empty array
	fs.writeFileSync('chatHistory.json', '[]', 'utf8');
}

// Function to add a log entry
function logAction(action, input) {
	// Read the current state from the file
	const currentState = JSON.parse(fs.readFileSync('log.json', 'utf8'));

	// Create a new log entry
	const logEntry = {
		timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
		action,
		input,
	};

	// Add the new log entry to the current state
	currentState.push(logEntry);

	// Write the updated state back to the file
	fs.writeFileSync('log.json', JSON.stringify(currentState, null, 2), 'utf8');
}
logAction('Init', 'MC bot start');

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
// const GoalFollow = goals.GoalFollow;
// const pvp = require('mineflayer-pvp').plugin;
// const armorManager = require('mineflayer-armor-manager');
// const autoeat = require('mineflayer-auto-eat');
// const commandsListJson = require('./bot-commands.json');
// const botGibberish = require('./botGibberish.json');
// const botAtGibberish = require('./botAtGibberish.json');
// const msStations = require('./ms-stations.json');
// const Entity = require('prismarine-entity');

//Mission Variables
let client = null; //偵測VIP請求
let vip = null; //偵測VIP請求
let vipName = null; //偵測VIP請求
let setupFlag = false; //偵測VIP請求
let fightAllState = false; //大亂鬥狀態
let missionState = false; //偵測是否正在進行任務
let guardPos = null; //守衛指令座標資訊
let firstSpawn = true; //偵測是否為重新進入server

const options = {
	host: IP['aternos']['host'],
	// port: "59302",
	username: ACCOUNT['username'],
	password: ACCOUNT['password'],
	logErrors: false,
	auth: 'microsoft', //if this acc is MS acc
};
const bot = mineflayer.createBot(options);
// exports.bot = bot;

//bot plugins
bot.loadPlugin(pathfinder);
// bot.loadPlugin(pvp);
// bot.loadPlugin(autoeat);
// bot.loadPlugin(armorManager);

// Log errors and kick reasons:
bot.on('kicked', console.log);
bot.on('error', console.log);

bot.once('spawn', () => {
	initialAIConfig();
	bot.on('chat', (username, message) => {
		if (username === bot.username) return;

		logAction('Received Chat', `message: ${message}`);

		const isGPTCommand = message.split(' ')[0] === '!gpt';
		if (isGPTCommand) {
			logAction('GPT Request', message);
			const request = message.substr(message.indexOf(' ') + 1);
			requestGPT(username, request);
		} else {
			switch (message) {
				case 'come':
					followHandler(username);
					break;

				case 'stop follow':
					stopFollowHandler();
					break;

				default:
					bot.chat('喔是哦');
					break;
			}
		}
	});

	bot.on('physicsTick', () => {
		lookAtNearestPlayer();
	});
});

function stopFollowHandler() {
	bot.pathfinder.stop();
	bot.chat('ok I stopped');
}

function followHandler(username) {
	const RANGE_GOAL = 5; // get within this radius of the player

	// const defaultMove = new Movements(bot);
	// defaultMove.canDig = false;
	// defaultMove.scafoldingBlocks = [];

	const target = bot.players[username]?.entity;
	if (!target) {
		bot.chat("I don't see you !");
		return;
	}
	bot.chat(`Coming, ${username} !`);
	// const { x: playerX, y: playerY, z: playerZ } = target.position;
	// bot.pathfinder.setMovements(defaultMove);
	// bot.pathfinder.setGoal(new GoalNear(playerX, playerY, playerZ, RANGE_GOAL));
	const goal = new GoalFollow(bot.players[username].entity, RANGE_GOAL);
	bot.pathfinder.setGoal(goal, true);
}

// async function test() {
// 	await initialAIConfig();
// 	await requestGPT('fishsont', '哈囉 Sakanabot！你終於上線啦');
// 	await requestGPT('fishsont', '哈囉 Sakanabot！你終於上線啦');
// }
// test();

async function requestGPT(username, message) {
	// form request object
	const request = {
		username,
		query: message,
		timestamp: Date.now(),
	};

	chatHistory.push({
		role: 'user',
		content: JSON.stringify(request),
	});

	// send chat history and get new response
	const completion = await openai.chat.completions.create({
		model: 'gpt-4',
		messages: chatHistory,
		temperature: 1,
		max_tokens: 512,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
	});

	// push newest response to chatHistory object
	const messageObj = completion.choices[completion.choices.length - 1].message;
	chatHistory.push(messageObj);

	const {
		action: responseAction,
		username: responseUsername,
		target: responseTarget,
		comment: responseComment,
	} = JSON.parse(messageObj.content);

	// save newest chat log to file
	fs.writeFileSync(
		'chatHistory.json',
		JSON.stringify(chatHistory, null, 2),
		'utf8'
	);

	console.log('Bot response:', responseComment);
	bot.chat(responseComment);

	switch (responseAction) {
		case 'chat':
			bot.chat(`DEBUG: chat command, target: ${responseTarget}`);
			break;
		case 'sleep':
			bot.chat(`DEBUG: sleep command, target: ${responseTarget}`);
			break;
		case 'goTo':
			bot.chat(`DEBUG: goTo command, target: ${responseTarget}`);
			break;
		case 'follow':
			bot.chat(`DEBUG: follow command, target: ${responseTarget}`);
			break;
		case 'attack':
			bot.chat(`DEBUG: attack command, target: ${responseTarget}`);
			break;
		case 'guard':
			bot.chat(`DEBUG: guard command, target: ${responseTarget}`);
			break;
		case 'error':
			bot.chat(`DEBUG: error command, target: ${responseTarget}`);
			break;

		default:
			bot.chat(`DEBUG: none command, target: ${responseTarget}`);
			break;
	}
}

async function initialAIConfig() {
	console.log('initializing GPT config...');

	// Read the file synchronously
	const prompt = fs.readFileSync('prompt.txt', 'utf-8');

	chatHistory.push({ role: 'system', content: prompt });
	chatHistory.push({
		role: 'user',
		content: JSON.stringify({
			username: 'Admin',
			query:
				'Sakana，我是系統發出的自動訊息，你已經順利登入這個伺服器。請你現在先對所有人打個招呼。',
			timestamp: 1695537479,
		}),
	});

	// send config and get response
	const completion = await openai.chat.completions.create({
		model: 'gpt-4',
		messages: chatHistory,
		temperature: 1,
		max_tokens: 512,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0,
	});

	const initResponse = completion.choices[0].message;

	chatHistory.push(initResponse);
	console.log('chatHistory', chatHistory);

	// save init chat history to file
	fs.writeFileSync(
		'chatHistory.json',
		JSON.stringify(chatHistory, null, 2),
		'utf8'
	);

	const initMessage = JSON.parse(initResponse.content).comment;
	console.log('Bot response:', initMessage);
	bot.chat(initMessage);
	console.log('GPT initialization done!');
}

// const {
//   mineflayer: mineflayerViewer
// } = require('prismarine-viewer')
// bot.once('spawn', () => {
//   mineflayerViewer(bot, {
//     port: 2620,
//     firstPerson: true
//   });
// });
// port is the minecraft server port, if first person is false, you get a bird's-eye view

/////////////////////閒置時自動開啟指令/////////////////////
// bot.once('spawn', () => {
// 	setTimeout(() => {
// 		firstSpawn = false;
// 	}, 500);
// });

// bot.on('spawn', () => {
// 	bot.pvp.attack(null);
// 	stopGuarding();
// 	missionState = false;
// 	console.log('(re)spawn');
// 	if (!firstSpawn) {
// 		bot.chat('我剛剛死掉了...இдஇ 有事要我做的話麻煩重新指派...');
// 	}
// });

// //跑去找距離最近之玩家
// function goFindSb() {
// 	console.log('goFindSb 閒置指令 start');
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	const playerFilter = (entity) => entity.type === 'player';
// 	const playerEntity = bot.nearestEntity(playerFilter); //若只要追蹤玩家那就在括號中加入 playerFilter
// 	const playerName = playerEntity.username;

// 	if (!playerEntity) {
// 		console.log('no nearby player to initiate goFindSb.');
// 		return;
// 	}

// 	bot.chat(playerName + '你現在在幹~麻?');

// 	//前往玩家
// 	const mcData = require('minecraft-data')(bot.version);
// 	const movements = new Movements(bot, mcData);
// 	movements.allowParkour = true;
// 	movements.canDig = false;
// 	movements.scafoldingBlocks = [];

// 	bot.pathfinder.setMovements(movements);
// 	const goal = new GoalFollow(playerEntity, 3);
// 	bot.pathfinder.setGoal(goal, true);
// }
// setInterval(goFindSb, 600000); //間隔10分鐘

// //受攻擊時反擊
// bot.on('entityHurt', (entity) => {
// 	if (missionState) return;
// 	if (entity === bot.entity) {
// 		if (guardPos === null) {
// 			bot.whisper(bot.username, 'bSelfMsgGuard');
// 			bot.chat(
// 				'好痛! 已啟動自衛模式(beta), 30秒後解除, 輸入"stop"來取消這個動作'
// 			);

// 			setTimeout(() => {
// 				bot.whisper(bot.username, 'bSelfMsgStop');
// 				bot.chat('已解除自衛模式.');
// 			}, 30000);
// 		}
// 	}
// });

// //聆聽 bot 內部通知
// bot.on('whisper', (username, message, translate, jsonMsg, matches) => {
// 	switch (message) {
// 		case 'bSelfMsgStop':
// 			bot.pvp.attack(null);
// 			stopGuarding();
// 			missionState = false;
// 			break;

// 		case 'bSelfMsgGuard':
// 			const player = bot.players[username];
// 			guardArea(player.entity.position);
// 			break;

// 		case 'gg':
// 			setTimeout(() => {
// 				bot.whisper(username, 'gg~');
// 			}, 1000);
// 			break;

// 		// case "bSelfMsg":

// 		//   break;

// 		default:
// 			console.log(message);
// 	}
// });

// //////////////////////////////////一般指令//////////////////////////////////

// //Chat Reply
// bot.on('chat', (username, message) => {
// 	if (message === 'good bot') {
// 		bot.chat('ya! 我最棒! o(^▽^)o');
// 		console.log(bot.players[username]);
// 	}
// });

// //End bot
// bot.on('chat', (username, message) => {
// 	if (message === 'b 88') {
// 		setTimeout(() => {
// 			bot.chat('那麼...我就先走了掰掰...இдஇ');
// 			setTimeout(() => {
// 				bot.end();
// 			}, 1000);
// 		}, 1000);
// 	}
// });

// //bot Commands List: message
// const cdbt = '","color":"dark_green","bold":"true"';
// const gray = '","color":"gray"}';

// bot.on('chat', (username, message) => {
// 	if (message === 'bot commands') {
// 		//原始用法： bot.chat('/tellraw @a {"text":"用法:/tellraw <玩家> <原始 json 訊息>"}');
// 		//參考： {"text":"["},{"text":"System","color":"dark_green","bold":"true"},{"text":"] "}
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' {"text":"' +
// 				commandsListJson['welcome'] +
// 				'","color":"dark_green","bold":"true"}'
// 		);
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' {"text":"' +
// 				commandsListJson['hyphen'] +
// 				'","color":"gray","bold":"true"}'
// 		);
// 		//chat reply
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['chatReply'] +
// 				cdbt +
// 				',"insertion":"good bot"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['chatReply_content'] +
// 				gray +
// 				']'
// 		);
// 		//end bot
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['endbot'] +
// 				cdbt +
// 				',"insertion":"b 88"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['endbot_content'] +
// 				gray +
// 				']'
// 		);
// 		//follow me
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['follow'] +
// 				cdbt +
// 				',"insertion":"b follow me"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['follow_cotent'] +
// 				gray +
// 				']'
// 		);
// 		//stop follow
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['stopFollow'] +
// 				cdbt +
// 				',"insertion":"b stop follow"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['stopFollow_content'] +
// 				gray +
// 				']'
// 		);
// 		//fighting
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['fighting'] +
// 				cdbt +
// 				',"insertion":"b fight me"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['fighting_content'] +
// 				gray +
// 				']'
// 		);
// 		//fighting all
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['fightingAll'] +
// 				cdbt +
// 				',"insertion":"b fight me"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['fightingAll_content'] +
// 				gray +
// 				']'
// 		);
// 		//stop fighting
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['fightingStop'] +
// 				cdbt +
// 				',"insertion":"stop"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['fightingStop_content'] +
// 				gray +
// 				']'
// 		);
// 		//protect
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['protect'] +
// 				cdbt +
// 				',"insertion":"b guard here"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['protect_content'] +
// 				gray +
// 				']'
// 		);
// 		//cover me
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['cover'] +
// 				cdbt +
// 				',"insertion":"b cover me"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['cover_content'] +
// 				gray +
// 				']'
// 		);
// 		//bot sleep
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['botSleep'] +
// 				cdbt +
// 				',"insertion":"b sleep"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['botSleep_content'] +
// 				gray +
// 				']'
// 		);
// 		//bot wake up
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['botWake'] +
// 				cdbt +
// 				',"insertion":"b wake up"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['botWake_content'] +
// 				gray +
// 				']'
// 		);
// 		//cip or craft iron pickaxe
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['cp'] +
// 				cdbt +
// 				',"insertion":"cp"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['cp_content'] +
// 				gray +
// 				']'
// 		);
// 		//sc or secret chat
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				commandsListJson['sc'] +
// 				cdbt +
// 				',"insertion":"/tell sakanabot sc"},' +
// 				'{"text":"' +
// 				commandsListJson['colon'] +
// 				gray +
// 				',{"text":"' +
// 				commandsListJson['sc_content'] +
// 				gray +
// 				']'
// 		);
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' {"text":"' +
// 				commandsListJson['hyphen'] +
// 				'","color":"gray","bold":"true"}'
// 		);
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' {"text":"' +
// 				commandsListJson['endingmsg'] +
// 				cdbt +
// 				'}'
// 		);
// 	}
// });

// //Admin's Assistant
// bot.on('chat', (username, message) => {
// 	function adminCommands() {
// 		if (username === bot.username) return;
// 		switch (message) {
// 			case 'b day':
// 				bot.chat('/time set day');
// 				bot.chat('已設定時間為白天。');
// 				break;

// 			case 'b night':
// 				bot.chat('/time set night');
// 				bot.chat('已設定時間為晚上。');
// 				break;

// 			case 'gms':
// 				bot.chat('/gamemode survival ' + username);
// 				bot.chat('已設定' + username + ' 為生存模式。');
// 				break;

// 			case 'gmc':
// 				bot.chat('/gamemode creative ' + username);
// 				bot.chat('已設定' + username + ' 為創造模式。');
// 				break;

// 			case 'bs':
// 				bot.chat('/gamemode survival');
// 				bot.chat('我現在是生存模式ㄌ！');
// 				break;

// 			case 'bc':
// 				bot.chat('/gamemode creative');
// 				bot.chat('我現在是創造模式ㄌ！');
// 				break;

// 			case 'always day':
// 				bot.chat('/time set 5000');
// 				bot.chat('/gamerule doDaylightCycle false');
// 				break;

// 			case 'always night':
// 				bot.chat('/time set midnight');
// 				bot.chat('/gamerule doDaylightCycle false');
// 				break;

// 			case 'reset time':
// 				bot.chat('/gamerule doDaylightCycle true');
// 				bot.chat('已重設日夜交替。');
// 				break;

// 			case 'bot where are you':
// 				const x = Math.floor(bot.entity.position.x);
// 				const y = Math.floor(bot.entity.position.y);
// 				const z = Math.floor(bot.entity.position.z);
// 				bot.chat('我的座標是' + x + ', ' + y + ', ' + z);

// 			default:
// 				console.log('other chats');
// 				break;
// 		}
// 	}
// 	adminCommands();
// });

// //Crafting Pickaxe through Ground Crafting (except wooden pickaxe)
// bot.on('chat', (username, message) => {
// 	if (message === 'cp' || message === 'craft pickaxe') {
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				'[鎬子合成開始]"' +
// 				',"color":"gold","bold":"true"},' +
// 				'{"text":"' +
// 				'請在 10 秒內將 2 個木棒與 3 個 鵝卵石/鐵錠/金錠/鑽石/獄髓錠 丟在一起，就能合成對應的鎬子' +
// 				'","color":"white"}' +
// 				']'
// 		);
// 		var time = 10000; //倒數7秒
// 		!(function MyCounter() {
// 			if (time <= 0) {
// 				//倒數完成
// 				//石鎬 cobblestone
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:cobblestone",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:stone_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//鐵鎬 iron
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:iron_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:iron_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//金鎬
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:gold_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:golden_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//鑽石鎬 diamond
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:diamond",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:diamond_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//獄髓鎬 netherite_ingot
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:netherite_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:netherite_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//結束
// 				bot.chat(
// 					'/tellraw ' +
// 						username +
// 						' [' +
// 						'{"text":"' +
// 						'[倒數結束，已完成合成]"' +
// 						',"color":"gold","bold":"true"}' +
// 						']'
// 				);
// 			} else {
// 				let sec = time / 1000;
// 				bot.chat(
// 					'/tellraw ' +
// 						username +
// 						' [' +
// 						'{"text":"' +
// 						'[ ' +
// 						sec +
// 						' 秒...]"' +
// 						',"color":"gold","bold":"true"}' +
// 						']'
// 				);
// 				setTimeout(MyCounter, 1000);
// 			}
// 			time -= 1000;
// 		})();
// 	}
// });

// ////////////////////////////////自動進行の聆聽事件////////////////////////////////

// //Clear weather
// bot.on('rain', function () {
// 	console.log('raining, proceed to turn off');
// 	setTimeout(() => {
// 		bot.chat('我不喜歡下雨! (눈‸눈)');
// 		bot.chat('/weather clear');
// 	}, 500);
// });

// //return arrows
// bot.on('playerCollect', (collector, itemDrop) => {
// 	if (collector !== bot.entity) return;
// 	const arrow = bot.inventory
// 		.items()
// 		.find((item) => item.name.includes('tipped_arrow'));
// 	if (arrow) {
// 		bot.chat('撿到特殊箭矢,我3秒後丟在地上喔');
// 		setTimeout(() => {
// 			bot.chat('丟');
// 			bot.tossStack(arrow);
// 		}, 3000);
// 	}
// });

// //Log In Greeting
// bot.once('spawn', () => {
// 	bot.chat("嗨嗨 我是Sakana's bot! ٩(ˊᗜˋ*)و 當前版本: " + botVersion);
// });

// Constantly Look At Neares Player
function lookAtNearestPlayer() {
	// const playerFilter = (entity) => entity.type === 'player';
	const playerEntity = bot.nearestEntity(); //若只要追蹤玩家那就在括號中加入 playerFilter

	if (!playerEntity) return;

	const pos = playerEntity.position.offset(0, playerEntity.height, 0);
	bot.lookAt(pos);
}

// // 自動進食
// bot.once('spawn', () => {
// 	bot.autoEat.options.priority = 'foodPoints';
// 	bot.autoEat.options.bannedFood = [];
// 	bot.autoEat.options.eatingTimeout = 3;
// 	bot.autoEat.options.checkOnItemPickup = false;
// }); // The bot eats food automatically and emits these events when it starts eating and stops eating.

// bot.on('autoeat_started', () => {
// 	console.log('Auto Eat started!');
// });

// bot.on('autoeat_stopped', () => {
// 	console.log('Auto Eat stopped!');
// });

// bot.on('health', () => {
// 	if (bot.food === 20) bot.autoEat.disable();
// 	// Disable the plugin if the bot is at 20 food points
// 	else bot.autoEat.enable(); // Else enable the plugin again
// 	setTimeout(() => {
// 		const sword = bot.inventory
// 			.items()
// 			.find((item) => item.name.includes('sword'));
// 		if (sword) bot.equip(sword, 'hand');
// 	}, 3000);
// });

// // Armor Manager (equip sword)
// bot.on('playerCollect', (collector, itemDrop) => {
// 	if (collector !== bot.entity) return;

// 	bot.armorManager.equipAll();

// 	setTimeout(() => {
// 		const sword = bot.inventory
// 			.items()
// 			.find((item) => item.name.includes('sword'));
// 		if (sword) bot.equip(sword, 'hand');
// 	}, 150);
// });

// ///////////////////////////任務相關指令，需注意不能相互衝突///////////////////////////

// //MINING ASSISTANT
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	let destination = null;
// 	let num = null;
// 	//檢查是否為有效請求
// 	if (message === 'b to base 1') {
// 		destination = 'fishsont';
// 		num = 1;
// 	} else if (message === 'b to base 2') {
// 		destination = 'tillmac';
// 		num = 2;
// 	} else if (message === 'b to base 3') {
// 		destination = 'yiting';
// 		num = 3;
// 	} else {
// 		return;
// 	}
// 	//有效請求，任務狀態開始
// 	missionState = true;
// 	bot.chat('收到, 前往' + num + '號站!');

// 	function toBase() {
// 		const mcData = require('minecraft-data')(bot.version);
// 		bot.pathfinder.setMovements(new Movements(bot, mcData));
// 		bot.pathfinder.setGoal(
// 			new goals.GoalBlock(
// 				msStations[destination]['x'],
// 				msStations[destination]['y'],
// 				msStations[destination]['z']
// 			)
// 		);
// 	}
// 	toBase();
// 	bot.on('goal_reached', (username, message) => {
// 		bot.chat('arrived');
// 		//延遲半秒後可銜接下半部分指令
// 	});
// });

// //STOP current mission, pathfinder, pvp
// bot.on('chat', (username, message) => {
// 	if (message === 'stop') {
// 		bot.chat('OK,停止目前的行動');
// 		bot.pvp.attack(null);
// 		stopGuarding();
// 		missionState = false;
// 		// bot.pathfinder.setGoal(null);
// 	}
// });

// // NEW Start Follow
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//檢查是否為有效請求
// 	if (message === 'b follow me') {
// 		const player = bot.players[username];

// 		if (!player || !player.entity) {
// 			bot.chat("I can't see you");
// 			return;
// 		}

// 		//任務狀態正式開啟
// 		missionState = true;
// 		bot.chat('ok!');
// 		const goal = new GoalFollow(player.entity, 3);
// 		bot.pathfinder.setGoal(goal, true);

// 		function followPlayer() {
// 			if (!player || !player.entity) {
// 				bot.chat("I can't see u");
// 				missionState = false;
// 				return;
// 			}

// 			const mcData = require('minecraft-data')(bot.version);
// 			const movements = new Movements(bot, mcData);
// 			movements.allowParkour = true;
// 			movements.canDig = false;
// 			movements.scafoldingBlocks = [];

// 			bot.pathfinder.setMovements(movements);

// 			const goal = new GoalFollow(player.entity, 3);
// 			bot.pathfinder.setGoal(goal, true);
// 		}
// 		followPlayer();
// 	}
// });

// // NEW Stop Follow & 停止任務
// bot.on('chat', (username, message) => {
// 	if (message === 'b stop follow') {
// 		bot.pathfinder.stop();
// 		bot.chat('ok I stopped');
// 		missionState = false;
// 	}
// });

// //Battle PVP
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//檢查是否為有效請求
// 	if (message === 'b fight me') {
// 		const player = bot.players[username];
// 		if (!player) {
// 			bot.chat("I can't see u");
// 			return;
// 		}
// 		//有效請求，任務狀態開始
// 		missionState = true;
// 		bot.chat('Are you ready to die?');

// 		const mcData = require('minecraft-data')(bot.version);
// 		const movements = new Movements(bot, mcData);

// 		bot.pvp.movements.canDig = false;

// 		bot.pvp.attack(player.entity);
// 	}
// });

// //Bot fight all
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//有效請求，任務狀態開始
// 	if (message === 'b fight all') {
// 		fightAllState = true;
// 		missionState = true;

// 		function fightAll() {
// 			if (fightAllState) {
// 				if (message === 'stop') {
// 					bot.chat('OK,停止目前的行動');
// 					bot.pvp.attack(null);
// 					stopGuarding();
// 					missionState = false;
// 					return;
// 				}
// 				const playerFilter = (entity) => entity.type === 'player';
// 				const fightAllEntity = bot.nearestEntity(playerFilter);

// 				if (!fightAllEntity) {
// 					bot.chat("I can't see u");
// 					fightAllState = false;
// 					missionState = false;
// 					return;
// 				}

// 				const mcData = require('minecraft-data')(bot.version);
// 				const movements = new Movements(bot, mcData);

// 				bot.pvp.movements.canDig = false;

// 				bot.pvp.attack(fightAllEntity);
// 			}
// 		}
// 		if (fightAllState) {
// 			setInterval(fightAll, 500);
// 		}
// 	}
// });

// //Guard
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//檢查是否為有效請求
// 	if (message === 'b guard here') {
// 		const player = bot.players[username];
// 		if (!player) {
// 			bot.chat('I can\t see u!');
// 			return;
// 		}

// 		//有效請求，任務狀態開始
// 		missionState = true;
// 		bot.chat('正在守衛這個區域');
// 		guardArea(player.entity.position);
// 	}
// });

// function guardArea(pos) {
// 	guardPos = pos.clone();

// 	if (!bot.pvp.target) {
// 		moveToGuardPos();
// 	}
// }

// function moveToGuardPos() {
// 	const mcData = require('minecraft-data')(bot.version);
// 	bot.pathfinder.setMovements(new Movements(bot, mcData));
// 	bot.pathfinder.setGoal(
// 		new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z)
// 	);
// }

// function stopGuarding() {
// 	guardPos = null;
// 	bot.pvp.stop();
// 	bot.pathfinder.setGoal(null);
// 	missionState = false;
// }

// bot.on('physicsTick', () => {
// 	if (!guardPos) return;

// 	const filter = (e) =>
// 		e.type === 'mob' &&
// 		e.position.distanceTo(bot.entity.position) < 16 &&
// 		(e.mobType === 'Zombie' ||
// 			e.mobType === 'Skeleton' ||
// 			e.mobType === 'Spider' ||
// 			e.mobType === 'Witch' ||
// 			e.mobType === 'Phantom' ||
// 			e.mobType === 'Creeper' ||
// 			e.mobType === 'Zombie Villager' ||
// 			e.mobType === 'Slime' ||
// 			e.mobType === 'Pillager' ||
// 			e.mobType === 'Husk' ||
// 			e.mobType === 'Drowned' ||
// 			e.mobType === 'Blaze'); //!== 'Armor Stand'

// 	const entity = bot.nearestEntity(filter);
// 	if (entity) {
// 		bot.pvp.movements.canDig = false;
// 		bot.pvp.attack(entity);
// 	}
// });

// bot.on('stoppedAttacking', () => {
// 	if (guardPos) {
// 		moveToGuardPos();
// 	}
// });

// //Cover me
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//檢查是否為有效請求
// 	if (message === 'b cover me') {
// 		const player = bot.players[username];
// 		if (!player) {
// 			bot.chat('I can\t see u!');
// 			return;
// 		}

// 		//有效請求，開始任務狀態
// 		missionState = true;
// 		bot.chat('正在保護你!');
// 		guardPos = 1;

// 		function followPlayer() {
// 			if (!player || !player.entity) {
// 				bot.chat("I can't see u");
// 				missionState = false;
// 				return;
// 			}

// 			const mcData = require('minecraft-data')(bot.version);
// 			const movements = new Movements(bot, mcData);
// 			movements.allowParkour = true;
// 			movements.canDig = false;
// 			movements.scafoldingBlocks = [];
// 			bot.pathfinder.setMovements(movements);

// 			const goal = new GoalFollow(player.entity, 3);
// 			bot.pathfinder.setGoal(goal, true);
// 		}
// 		followPlayer();

// 		//detect stop
// 		bot.on('stoppedAttacking', () => {
// 			function followPlayer() {
// 				if (!player || !player.entity) {
// 					bot.chat("I can't see u");
// 					missionState = false;
// 					return;
// 				}

// 				const mcData = require('minecraft-data')(bot.version);
// 				const movements = new Movements(bot, mcData);
// 				movements.allowParkour = true;
// 				movements.canDig = false;
// 				movements.scafoldingBlocks = [];
// 				movements.blocksCantBreak = new Set();

// 				bot.pathfinder.setMovements(movements);

// 				const goal = new GoalFollow(player.entity, 3);
// 				bot.pathfinder.setGoal(goal, true);
// 			}
// 			followPlayer();
// 		});
// 	}
// });

// //偵測VIP請求
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	function setupVipRequest() {
// 		if (message === 'b set vip') {
// 			// if (username === bot.username) return;
// 			bot.chat('請告知VIP對象?');
// 			client = username;
// 			setTimeout(() => {
// 				setupFlag = true;
// 			}, 500);

// 			console.log('偵測VIP請求');
// 			console.log(client);
// 			console.log(setupFlag);
// 		}
// 	}
// 	setupVipRequest();
// });

// //鎖定vip人物
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	function setupVipName() {
// 		//檢查是否為有效指令
// 		if (client === username && setupFlag === true) {
// 			vip = bot.players[message];
// 			vipName = message;
// 			if (!vip) {
// 				bot.chat('我沒看到' + vipName);
// 				client = null;
// 				vip = null;
// 				vipName = null;
// 				setupFlag = false;
// 				missionState = false;
// 				return;
// 			}
// 			if (vipName === bot.username) {
// 				bot.chat("額...你用錯指令了，請用'b guard here'指派我駐守一個地點。");
// 				client = null;
// 				vip = null;
// 				vipName = null;
// 				setupFlag = false;
// 				missionState = false;
// 				return;
// 			}
// 			//有效請求，開始任務狀態
// 			missionState = true;
// 			bot.chat('正在保護' + vipName);
// 			vipProceed();
// 			console.log(
// 				'client=' + client + ', vipName=' + vipName + ', setupFlag=' + setupFlag
// 			);
// 			setTimeout(() => {
// 				setupFlag = false;
// 				client = null;
// 			}, 500);
// 		}
// 	}
// 	setupVipName();
// });

// //實踐vip請求
// function vipProceed() {
// 	guardPos = 1;

// 	function followPlayer() {
// 		if (!vip || !vip.entity) {
// 			bot.chat('我找不到' + vipName);
// 			missionState = false;
// 			return;
// 		}

// 		const mcData = require('minecraft-data')(bot.version);
// 		const movements = new Movements(bot, mcData);
// 		movements.allowParkour = true;
// 		movements.canDig = false;
// 		movements.scafoldingBlocks = [];

// 		bot.pathfinder.setMovements(movements);

// 		const goal = new GoalFollow(vip.entity, 3);
// 		bot.pathfinder.setGoal(goal, true);
// 	}
// 	followPlayer();

// 	//detect stop
// 	bot.on('stoppedAttacking', () => {
// 		function followPlayer() {
// 			if (!vip || !vip.entity) {
// 				bot.chat('我找不到' + vipName);
// 				missionState = false;
// 				return;
// 			}

// 			const mcData = require('minecraft-data')(bot.version);
// 			const movements = new Movements(bot, mcData);
// 			movements.allowParkour = true;
// 			movements.canDig = false;
// 			movements.scafoldingBlocks = [];
// 			movements.blocksCantBreak = new Set();

// 			bot.pathfinder.setMovements(movements);

// 			const goal = new GoalFollow(vip.entity, 3);
// 			bot.pathfinder.setGoal(goal, true);
// 		}
// 		followPlayer();
// 	});
// }

// //Detect Sleep Command
// let mcData;
// bot.on('inject_allowed', () => {
// 	mcData = require('minecraft-data')(bot.version);
// });

// bot.on('chat', (username, message) => {
// 	//檢查是否為有效指令
// 	if (username === bot.username) return;

// 	switch (message) {
// 		case 'b sleep':
// 			//檢查是否在任務中
// 			if (missionState) {
// 				bot.chat('現在不是時候!');
// 				return;
// 			}

// 			locateBedBlock();
// 			break;
// 		case 'b wake up':
// 			wakeUp();
// 			break;
// 	}
// });

// // Wake up
// function wakeUp() {
// 	bot.wake((err) => {
// 		if (err) {
// 			bot.chat("I can't wake up");
// 		} else {
// 			bot.chat('I woke up');
// 		}
// 	});
// }

// //Go towards bed
// function locateBedBlock() {
// 	missionState = true;

// 	const mcData = require('minecraft-data')(bot.version);
// 	const movements = new Movements(bot, mcData);
// 	movements.allowParkour = true;
// 	movements.canDig = false;
// 	movements.scafoldingBlocks = [];
// 	bot.pathfinder.setMovements(movements);

// 	const bedBlock = bot.findBlock({
// 		matching: mcData.blocksByName.white_bed.id,
// 		maxDistance: 16,
// 	});
// 	if (!bedBlock) {
// 		bot.chat('我在附近找不到白色的床...');
// 		missionState = false;
// 		return;
// 	}
// 	const x = bedBlock.position.x;
// 	const y = bedBlock.position.y + 1;
// 	const z = bedBlock.position.z;
// 	// const goal = new GoalBlock(x, y, z)
// 	// bot.pathfinder.setGoal(goal)

// 	// Await pathfinder to complete the goal, then move to bot.chat and print "I've arrived !"
// 	bot.pathfinder.goto(
// 		new GoalNear(
// 			bedBlock.position.x,
// 			bedBlock.position.y,
// 			bedBlock.position.z,
// 			1
// 		)
// 	);
// 	bot.on('goal_reached', (goal) => {
// 		bot.chat('我找到床了!');
// 		goToSleep();
// 	});
// }

// //Use Bed
// function goToSleep() {
// 	const bed = bot.findBlock({
// 		matching: mcData.blocksByName.white_bed.id,
// 	});
// 	bot.sleep(bed, (err) => {
// 		if (err) {
// 			setTimeout(() => {
// 				bot.chat('我到了床邊,但是睡不了');
// 				missionState = false;
// 			}, 500);
// 		} else {
// 			setTimeout(() => {
// 				bot.chat('晚安~');
// 				missionState = false;
// 			}, 500);
// 		}
// 	});
// }

// //Crafting Pickaxe through Ground Crafting (except wooden pickaxe)
// bot.on('chat', (username, message) => {
// 	if (message === 'cp' || message === 'craft pickaxe') {
// 		bot.chat(
// 			'/tellraw ' +
// 				username +
// 				' [' +
// 				'{"text":"' +
// 				'[鎬子合成開始]"' +
// 				',"color":"gold","bold":"true"},' +
// 				'{"text":"' +
// 				'請在 10 秒內將 2 個木棒與 3 個 鵝卵石/鐵錠/金錠/鑽石/獄髓錠 丟在一起，就能合成對應的鎬子' +
// 				'","color":"white"}' +
// 				']'
// 		);
// 		var time = 10000; //倒數7秒
// 		!(function MyCounter() {
// 			if (time <= 0) {
// 				//倒數完成
// 				//石鎬 cobblestone
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:cobblestone",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:stone_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//鐵鎬 iron
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:iron_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:iron_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//金鎬
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:gold_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:golden_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//鑽石鎬 diamond
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:diamond",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:diamond_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//獄髓鎬 netherite_ingot
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:stick",Count:2b}}] add craft1'
// 				);
// 				bot.chat(
// 					'/tag @e[nbt={OnGround:1b,Item:{id:"minecraft:netherite_ingot",Count:3b}}] add craft2'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run summon item ~ ~ ~ {Tags:["itemkill1"],PickupDelay:20,Item:{id:"minecraft:netherite_pickaxe",Count:1b}}'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=craft1] as @e[tag=craft2,distance=..1] run particle minecraft:happy_villager ~ ~.4 ~ .2 .2 .2 0 15'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft1,distance=..1]'
// 				);
// 				bot.chat(
// 					'/execute at @e[tag=itemkill1] run kill @e[tag=craft2,distance=..1]'
// 				);
// 				bot.chat('/tag @e[type=item] remove itemkill1');
// 				//結束
// 				bot.chat(
// 					'/tellraw ' +
// 						username +
// 						' [' +
// 						'{"text":"' +
// 						'[倒數結束，已完成合成]"' +
// 						',"color":"gold","bold":"true"}' +
// 						']'
// 				);
// 			} else {
// 				let sec = time / 1000;
// 				bot.chat(
// 					'/tellraw ' +
// 						username +
// 						' [' +
// 						'{"text":"' +
// 						'[ ' +
// 						sec +
// 						' 秒...]"' +
// 						',"color":"gold","bold":"true"}' +
// 						']'
// 				);
// 				setTimeout(MyCounter, 1000);
// 			}
// 			time -= 1000;
// 		})();
// 	}
// });

// //////////////////////////////彩蛋&隱藏指令區///////////////////////////////

// //bot講幹話，要增改幹話資料請到botGibberish.json內修改
// bot.once('spawn', () => {
// 	function sayGibberish() {
// 		let randomNum = Math.floor(Math.random() * botGibberish.length);
// 		bot.chat(botGibberish[randomNum]);
// 	}
// 	setInterval(sayGibberish, 180000);
// });

// //bot針對在線玩家講幹話，要增改幹話資料請到botAtGibberish.json內修改
// bot.once('spawn', () => {
// 	function trashTalk() {
// 		const players = Object.keys(bot.players);
// 		const randomPNum = Math.floor(Math.random() * players.length);
// 		const randomGNum = Math.floor(Math.random() * botAtGibberish.length);

// 		bot.chat(players[randomPNum] + botAtGibberish[randomGNum]);
// 	}
// 	setInterval(trashTalk, 240000);
// });

// //匿名傳話人
// bot.on('whisper', (username, message) => {
// 	if (message === 'sc' || message === 'secret chat') {
// 		bot.whisper(username, '你想傳訊息給誰呢？請用 /tell 告訴我');
// 		bot.once('whisper', (username, message) => {
// 			let player_2 = message;
// 			bot.whisper(username, '請用 /tell 告訴我你想對' + player_2 + '說的話');
// 			bot.once('whisper', (username, message) => {
// 				bot.chat(
// 					'/tellraw ' +
// 						player_2 +
// 						' [' +
// 						'{"text":"' +
// 						'[有人偷偷對你說]"' +
// 						',"color":"gold","bold":"true"},' +
// 						'{"text":"' +
// 						message +
// 						'","color":"white"}' +
// 						']'
// 				);
// 				// /tellraw DJSunyu [{"text":"[有人偷偷對你說],"color":"gold","bold":"true"},{"text":"message"}]
// 				// bot.whisper(player_2, '有人對你說：' + message);
// 			});
// 		});
// 	}
// });

// //Kill Yiting Chen
// bot.on('chat', (username, message) => {
// 	//檢查是否在任務中
// 	if (missionState) return;

// 	//檢查是否為有效指令
// 	if (message === 'b kill yiting') {
// 		const commander = bot.players['fishsont'];
// 		const victim = bot.players['Yiting_Chen'];

// 		if (!commander) {
// 			bot.chat('你無法控制我');
// 			return;
// 		}
// 		//有效指令，開始任務狀態
// 		missionState = true;
// 		bot.pvp.movements.canDig = false;
// 		bot.chat('奕廷,你死定啦哈哈哈');
// 		bot.pvp.attack(victim.entity);
// 	}
// });
