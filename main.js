'use strict';

const utils = require('@iobroker/adapter-core');
const dgram = require('dgram');
const uuid = require('./lib/uuid');
const acc = require('./lib/aes');

const adapterName = require('./package.json').name.split('.').pop();
let client = dgram.createSocket('udp4');

let adapter;

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
        const aaa = acc.generateAcc("967DC7CD55376DA9", "5acb1823-d7ff-46");
        if (!id || !state || state.ack) {
            return;
        }
        const key = adapter.config.user;
        if (key === null || key.length !== 16){
            adapter.log.info("please enter the key");
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
            }
            if (TempOperation !== null)
            {
                controlDevice(TempOperation, null, obj.native.mac, obj.native.deviceType, obj.native.token, key);
            } else if(TempTargetPosition !== null)
            {
                controlDevice(null,TempTargetPosition, obj.native.mac, obj.native.deviceType, obj.native.token, key);
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

    const key = adapter.config.user;
    adapter.log.info(key)
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
                setStates(hub_mac+'.'+obj.mac+'.currentPosition', obj.data.currentPosition.toString());
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
    adapter.log.info("send：" + sendData);
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
            //AccessToken: acc.generateAcc("967DC7CD55376DA9", "5acb1823-d7ff-46"),
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
            //AccessToken: acc.generateAcc("967DC7CD55376DA9", "5acb1823-d7ff-46"),
            msgID: uuid.generateUUID(),
            data:{
                targetPosition: 100-targetPosition
            }
        }
    }
    sendData(JSON.stringify(sendData_obj));
}

function sendData(data)
{
    console.log("send：" + data);
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
