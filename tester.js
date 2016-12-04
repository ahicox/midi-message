/*
    for testing midi-message.js
*/
"use strict";


/*
    requires #################################################
*/

// for shell interaction
var readlineSync = require('readline-sync');

// for talkin' midi
var midi = require('midi');

// to set up an event emitter for the lfo
const EventEmitter = require('events');

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
for (var i=0; i < count; i++){
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
    spawn an LFO we can use for stuff ########################
*/
var lfoAmp   = 1;
var lfoFreq  = 1;
var lfoPhase = 0;
var lfoValue = 0;
var lfoEnable = false;

var lfoTimeDelta = .01;
var lfoTime = 0;

// reset the lfo time to 0
function initLFO(){
    lfoTime = 0;
}

// lfoMidiInterface (set this to the midi interface you want the lfo to be able to talk to)
var lfoMidiInterface;

// a hook to emit an event when the lfo is spewing an output
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

// this catches events thrown off by the lfo (when enabled)
myEmitter.on('lfo', function(val){
    console.log("[lfo]: " + val);

    // calculate a bend value where:
    //  -1  => 0 (minimum bend)
    //  0   => 8192 (no bend)
    //  1   => 16383 (max bend)
    var bendVal = Math.floor(8192 + (8192 * val));

    console.log("[bend value]:" + bendVal);

    // make a pitch bend midi message
    var bendMsg = midiMessage.makeMidiMessage({
        messageType: "pitch bend",
        value: bendVal,
        channel: 1
    });

    // ok, so here, we're just gonna have to
    // trust that lfoMidiInterface actually points
    // to a midi interface
    if (lfoMidiInterface){
        lfoMidiInterface.sendMessage(bendMsg);
    }
});

// this oscilates between -1 and 1
initLFO();
setInterval(function(){
    lfoTime += lfoTimeDelta;
    lfoValue = lfoAmp * ((Math.sin((lfoFreq * lfoTime) + lfoPhase)));
    if (lfoEnable){
        myEmitter.emit('lfo', lfoValue);
    }
}, 10);


/*
    playground ###############################################
    pipes messages from selected input to selected output
    here's where we can test out the midi-message stuff
*/
input.on('message', function(dT, msg){

    // insert shenanigans here
    var info = midiMessage.parseMidiMessage(msg);

    // tmp Log Raw for pitch bend
    if (info.messageType == 'pitch bend'){
        console.log("[raw midi]: " + info.raw);
    }

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

    // pitch bend lfo madness!
    if (info.messageType == 'note on'){
        initLFO();
        lfoEnable = true;
        lfoMidiInterface = output;
    } else if (info.messageType == 'note off'){
        lfoEnable = false;
        lfoMidiInterface = false;
    }

    // catch controls
    if (info.messageType == 'control'){

        // map cc-14 to LFO speed
        if (info.controllerNumber == 14){

            // gives me a value between 0 and 1
            var pct = info.value/127;
            lfoFreq = 100 * pct;
            console.log('[lfo freq]: ' + lfoFreq);
        }
    }

    // pipe it out
    if (! pipeOverride){
        output.sendMessage(msg);
    }
});
