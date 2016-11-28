/*
    for testing midi-message.js
*/



/*
    requires #################################################
*/

// for shell interaction
var readlineSync = require('readline-sync');

// for talkin' midi
var midi = require('midi');

// let's start by trying to include the damn thing
const midiMsgClass = require('./midi-message.js');
var midiMessage = new midiMsgClass();

/*
    set up midi interfaces ###################################
*/

var input = new midi.input();
// spit out a list of midi interfaces
var count = input.getPortCount();
console.log("[found]: " + count + " midi inputs");
for (i=0; i < count; i++){
    var name = input.getPortName(i);
    console.log("\t[" + i + "]: " + name );
}

// select an input interface
var inputNum = readlineSync.question('use which port for input? [0 - ' + (count - 1) + '] ');
console.log("[using]: " + inputNum);

// select an output interface
var output = new midi.output();
count = output.getPortCount();
console.log("[found]: " + count + " midi outputs");
for (i=0; i < count; i++){
    var name = output.getPortName(i);
    console.log("\t[" + i + "]: " + name );
}

var outputNum = readlineSync.question('use which port for output? [0 - ' + (count - 1) + '] ');
console.log("[using]: " + outputNum);

input.openPort(Number(inputNum));
output.openPort(Number(outputNum));


/*
    playground ###############################################
    pipes messages from selected input to selected output
    here's where we can test out the midi-message stuff
*/
input.on('message', function(dT, msg){

    // insert shenanigans here
    var info = midiMessage.parseMidiMessage(msg);

    // make a nice string to log on the console
    var logMsg = "";
    [
        'channel',
        'messageType',
        'noteNumber',
        'noteName',
        'velocity',
        'controllerNumber',
        'value',
        'controlInfo'
    ].forEach(function(key){
        if (info.hasOwnProperty(key)){
            if (key == 'controlInfo'){
                logMsg = logMsg + " [control name]: " + info.controlInfo.controlName;
            }else{
                logMsg = logMsg + " [" + key + "]: " + info[key];
            }
        }
    });
    console.log(logMsg);

    // lets try constructing some note messages
    // we'll use controller 102 with a value > 0 as toggle on and < 1 toggle off
    var testChord = ['D#(5)', 'G(5)', 'C(5)']; // good ol Cmin
    var pipeOverride = false;
    if ((info.messageType == 'control') && (info.controllerNumber == 102)){
        pipeOverride = true;
        if (info.value > 0){
            console.log("trigger: on");
            testChord.forEach(function(nName){
                var nMsg;
                if (! (nMsg = midiMessage.makeMidiMessage({
                    messageType: "note on",
                    noteName: nName,
                    velocity: 108,
                    channel: 1
                }))){
                    console.log("[error]: " + midiMessage.error.errorMessage)
                }else{
                    output.sendMessage(nMsg);
                }
            });
        }else{
            console.log("trigger: off");
            testChord.forEach(function(nName){
                var nMsg;
                if (! (nMsg = midiMessage.makeMidiMessage({
                    messageType: "note off",
                    noteName: nName,
                    velocity: 108,
                    channel: 1
                }))){
                    console.log("[error]: " + midiMessage.error.errorMessage)
                }else{
                    output.sendMessage(nMsg);
                }
            });
        }
    }



    // pipe it out
    if (! pipeOverride){
        output.sendMessage(msg);
    }
});
