'use strict';

const utils = require('@iobroker/adapter-core');
const dgram = require('dgram');
const uuid = require('./lib/uuid');
const acc = require('./lib/aes');

const adapterName = require('./package.json').name.split('.').pop();
let client = dgram.createSocket('udp4');

let adapter;
let key = "";
let openPercent = "";

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {name: adapterName});
    adapter = new utils.Adapter(options);

    adapter.on('ready', function () {
        main();
    });

    adapter.on('objectChange', function (id, obj) {
        if (obj) {
            // The object was changed
            adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            adapter.log.info(`object ${id} deleted`);
        }
    });

    adapter.on('stateChange', function (id, state) {
        if (!id || !state || state.ack) {
            return;
        }
        if (key.length !== 16){
            adapter.log.info("please enter the right key");
            return;
        }
        const pos = id.lastIndexOf('.');
        const channelId = id.substring(0, pos);
        const IDkeys = id.split('.');
        const IDState = IDkeys[IDkeys.length - 1];

        var TempOperation = null;
        var TempTargetPosition = null;

        adapter.getObject(channelId, (err, obj) => {
            adapter.log.info(obj.native.mac);

            if (IDState === "up") {
                TempOperation = 1;
            } else if (IDState === "down") {
                TempOperation = 0;
            } else if (IDState === "stop") {
                TempOperation = 2;
            } else if (IDState === "targetPosition") {
                TempTargetPosition =  parseInt(state.val);
            } else if (IDState === "fav"){
                TempOperation = 12;
            }
            if (TempOperation !== null)
            {
                controlDevice(TempOperation, null, obj.native.mac, obj.native.deviceType, obj.native.token, key);
            } else if(TempTargetPosition !== null)
            {
                if (openPercent=== 0)
                {
                    controlDevice(null,TempTargetPosition, obj.native.mac, obj.native.deviceType, obj.native.token, key);
                }
                else if(openPercent === 100)
                {
                    controlDevice(null,100-TempTargetPosition, obj.native.mac, obj.native.deviceType, obj.native.token, key);
                }
            }
        });

    });
    return adapter;
}

function setStates(id, val) {
    adapter.setState(id, {
        val: val,
        ack: true
    });
    return '';
}

async function main() {
    client.bind(32101, function () {
        client.addMembership('238.0.0.18');
    })

    key = adapter.config.user;
    openPercent = adapter.config.openPercent;
    adapter.subscribeStates('*');
    getDeviceList();

    client.on('message', (msg, rinfo) => {
        adapter.log.info(`receive server message from ${rinfo.address}: ${rinfo.port}: ${msg}`);
        let obj = JSON.parse(msg.toString());
        if (obj.msgType === "GetDeviceListAck") {
            adapter.setObjectNotExists(obj.mac, {
                type: 'device',
                common: {
                    name: obj.mac,
                    role: 'room'
                },
                native: {
                    token: obj.token,
                    deviceType: obj.deviceType,
                    mac: obj.mac
                }
            });
            for (var motor in obj.data) {
                if (obj.mac !== obj.data[motor].mac)
                {
                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac, {
                        type: 'channel',
                        common: {
                            name: obj.data[motor].mac,
                            role: 'blind'
                        },
                        native: {
                            token: obj.token,
                            mac: obj.data[motor].mac,
                            deviceType: obj.data[motor].deviceType,
                            hubMac: obj.mac
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.down', {
                        type: 'state',
                        common: {
                            name: 'down',
                            role: 'button',
                            write: true,
                            read: false
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.stop', {
                        type: 'state',
                        common: {
                            name: 'stop',
                            role: 'button',
                            write: true,
                            read: false
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.up', {
                        type: 'state',
                        common: {
                            name: 'up',
                            role: 'button',
                            write: true,
                            read: false
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.fav', {
                        type: 'state',
                        common: {
                            name: 'fav',
                            role: 'button',
                            write: true,
                            read: false
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.targetPosition', {
                        type: 'state',
                        common: {
                            name: 'targetPosition',
                            unit: '%',
                            role: 'value.motor',
                            write: true,
                            read: true
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.rssi', {
                        type: 'state',
                        common: {
                            name: 'rssi',
                            unit: 'db',
                            role: 'value.motor',
                            write: false,
                            read: true
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.batteryLevel', {
                        type: 'state',
                        common: {
                            name: 'batteryLevel',
                            unit: 'V',
                            role: 'value.motor',
                            write: false,
                            read: true
                        }
                    });

                    adapter.setObjectNotExists(obj.mac + '.' + obj.data[motor].mac + '.currentPosition', {
                        type: 'state',
                        common: {
                            name: 'currentPosition',
                            unit: '%',
                            role: 'value.motor',
                            write: false,
                            read: true
                        }
                    });
                    setStates(obj.mac + '.' + obj.data[motor].mac + '.currentPosition', "unknow");
                    controlDevice(5, null, obj.data[motor].mac, obj.data[motor].deviceType, obj.token, key);
                }
            }
        }
            if (obj.msgType === "WriteDeviceAck") {
                adapter.log.info("WriteDeviceAck");
            }
            if (obj.msgType === "Heartbeat") {
                adapter.log.info("Heartbeat");
            }
            if (obj.msgType === "Report") {
                const hub_mac = obj.mac.substring(0, obj.mac.length-4);
                adapter.log.info("mac："+hub_mac+"  currentPercentage："+obj.data.currentPosition);
                if (openPercent === "0")
                {
                    setStates(hub_mac+'.'+obj.mac+'.currentPosition', obj.data.currentPosition.toString());
                }
                else if(openPercent === "100")
                {
                    setStates(hub_mac+'.'+obj.mac+'.currentPosition', (100 - obj.data.currentPosition).toString());
                }
                setStates(hub_mac+'.'+obj.mac+'.rssi', obj.data.RSSI.toString());
                if (obj.data.voltageMode === 1)
                {
                    setStates(hub_mac+'.'+obj.mac+'.batteryLevel', (obj.data.batteryLevel/100).toString());
                }
                else
                {
                    setStates(hub_mac+'.'+obj.mac+'.batteryLevel', "120 or 220");
                }

            }
    });
}

function getDeviceList()
{
    let sendData_obj ={
        msgType: "GetDeviceList",
        msgID: uuid.generateUUID(),
    }
    let sendData = JSON.stringify(sendData_obj);
    //adapter.log.info("send：" + sendData);
    client.send(sendData,32100,'238.0.0.18', function (error) {
        if (error)
        {
            console.log(error)
        }
    })
}

function controlDevice(operation, targetPosition, mac, deviceType, token, key)  //控制设备
{
    let sendData_obj;
    if (operation !== null)
    {
        sendData_obj ={
            msgType: "WriteDevice",
            mac: mac,
            deviceType: deviceType,
            AccessToken: acc.generateAcc(token, key),
            msgID: uuid.generateUUID(),
            data:{
                operation: operation
            }
        }
    }
    else if(targetPosition != null)
    {
        sendData_obj ={
            msgType: "WriteDevice",
            mac: mac,
            deviceType: deviceType,
            AccessToken: acc.generateAcc(token, key),
            msgID: uuid.generateUUID(),
            data:{
                targetPosition: targetPosition
            }
        }
    }
    sendData(JSON.stringify(sendData_obj));
}

function sendData(data)
{
    //console.log("send：" + data);
    client.send(data,32100,'238.0.0.18', function (error) {
        if (error)
        {
            adapter.log.info("send failed:"+ error);
        }
    })
}


// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
