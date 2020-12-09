'use strict';
let adapter;

const HelpergenerateUUID = function () { // Public Domain/MIT
	var d = new Date().getTime();
	if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
		d += performance.now(); //use high-precision timer if available
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (d + Math.random() * 16) % 16 | 0;
		d = Math.floor(d / 16);
		return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	});
};

const GetMsgID = function(){
	var date = new Date();
	var year = String(date.getFullYear());
	var month = String(date.getMonth()+1).padStart(2, '0');
	var day = String(date.getDate()).padStart(2, '0');
	var hour = String(date.getHours()).padStart(2, '0');
	var minute = String(date.getMinutes()).padStart(2, '0');
	var second = String(date.getSeconds()).padStart(2, '0');
	var ms = String(date.getMilliseconds()).padStart(3, '0');
	return (year+month+day+hour+minute+second+ms);
}

exports.generateUUID = GetMsgID;
// exports.generateUUID = HelpergenerateUUID;