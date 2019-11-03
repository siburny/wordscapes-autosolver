const exec = require('child_process').execSync;
const execAsync = require('child_process').exec;
const fs = require('fs');
const Combinatorics = require('js-combinatorics');
const monkey = require('adbkit-monkey');
const moment = require('moment');

// Arguments
var args = process.argv.slice(2);

// Consts
const ADB = '"c:\\Users\\' + require("os").userInfo().username + '\\AppData\\Local\\Android\\sdk\\platform-tools\\adb.exe"';
const file = args[0] || 'screen.png';
const IM = '"c:\\Program Files\\ImageMagick-7.0.8-Q16\\convert.exe"';
const words = fs.readFileSync('words_alpha.txt').toString().split('\n').map(Function.prototype.call, String.prototype.trim);
const retries = [{
        max_letters: 6,
        negate: false
    },
    {
        max_letters: 6,
        negate: true
    },
    {
        max_letters: 7,
        negate: false
    },
    {
        max_letters: 7,
        negate: true
    },
    {
        max_letters: 8,
        negate: false
    },
    {
        max_letters: 8,
        negate: true
    },
];

// Load alphabet
const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
var alphabet_scores = {};
for (let j = 0; j < alphabet.length; j++) {
    let out = exec(IM + ' letters\\' + alphabet[j] + '.png -gravity center -scale 6x6^! -compress none -depth 16 ppm:-');

    let a = out.toString().split('\n');
    alphabet_scores[alphabet[j]] = [];
    for (let k = 2; k < a.length; k++) {
        alphabet_scores[alphabet[j]].push.apply(alphabet_scores[alphabet[j]], a[k].split(' ').filter(Boolean));
    }
}

// load auxiliary 
(function () {
    let out = exec(IM + ' letters\\ad.png -gravity center -scale 6x6^! -compress none -depth 16 ppm:-');

    let a = out.toString().split('\n');
    alphabet_scores['ad'] = [];
    for (let k = 2; k < a.length; k++) {
        alphabet_scores['ad'].push.apply(alphabet_scores['ad'], a[k].split(' ').filter(Boolean));
    }
})();

// Global vars
var found_words_index, found_words, client, w, attempt = 0,
    gameId;

// Prep
exec(ADB + ' shell killall com.android.commands.monkey &');
exec(ADB + ' forward tcp:1080 tcp:1080');
var adb_process = execAsync(ADB + ' shell monkey --port 1080');


function play() {

    // Get screenshot
    if (file == 'screen.png') {
        exec(ADB + ' shell screencap -p /sdcard/screen.png');
        exec(ADB + ' pull /sdcard/screen.png output\\' + gameId);
        exec(ADB + ' shell rm /sdcard/screen.png');
    }

    checkForAd();

    console.log();
    console.log('Try #' + (attempt + 1) + ': max_letters -> ' + retries[attempt].max_letters + ', negate -> ' + retries[attempt].negate);

    // center
    const X = 539,
        Y = 1800,
        R = 240,
        W = 160,
        H = 130;

    var quit = false;

    var found_letters = [];
    var found_coordinates = [];
    for (let l = 0; l < retries[attempt].max_letters; l++) {
        let x = Math.floor(X + R * Math.sin(l * 2 * Math.PI / retries[attempt].max_letters) - W / 2);
        let y = Math.floor(Y - R * Math.cos(l * 2 * Math.PI / retries[attempt].max_letters) - H / 2);

        exec(IM + ' ' + (file == 'screen.png' ? 'output\\' + gameId + '\\' : '') + file + ' -crop ' + W + 'x' + H + '+' + x + '+' + y + ' +repage ' + (retries[attempt].negate ? '-channel RGB -negate' : '') + ' -white-threshold 5% -flatten -fuzz 5% -trim +repage output\\' + gameId + '\\out' + l + '.png');

        let out = exec(IM + ' output\\' + gameId + '\\out' + l + '.png -gravity center -scale 6x6^! -compress none -depth 16 ppm:-');
        let a = out.toString().split('\n');
        let score = [];
        for (let k = 2; k < a.length; k++) {
            score.push.apply(score, a[k].split(' ').filter(Boolean));
        }

        //check the score
        var pick_length = 100000000,
            pick_letter;
        for (let k = 0; k < alphabet.length; k++) {
            var length = 0;
            for (let s = 0; s < score.length; s++) {
                length += Math.pow(score[s] - alphabet_scores[alphabet[k]][s], 2);
            }
            length = Math.sqrt(length);

            if (length < pick_length) {
                pick_length = length;
                pick_letter = k;
            }
        }

        if (pick_length < 50000) {
            console.log('Letter #' + l + ': ' + alphabet[pick_letter] + ' (' + pick_length + ')');
            found_letters.push(alphabet[pick_letter]);
            found_coordinates[l] = {
                x: x + W / 2,
                y: y + H / 2
            };
        } else {
            console.log('Letter #' + l + ': NO match (' + pick_length + ')');
            quit = true;
        }
    }

    console.log();

    if (quit || (found_letters[0] == 'i' && found_letters[1] == 'i' && found_letters[2] == 'i' && found_letters[3] == 'i')) {
        if (++attempt == retries.length) {
            console.log();
            console.log('Give up')
            adb_process.kill();
            client.end();
            process.exit();
        } else {
            // client.tap(539, 1770, function () {});
            // setTimeout(function () {
            //     client.tap(872, 534, function () {});
            // }, 500);

            setTimeout(play, 6000);
            return;
        }
    }

    console.log();

    found_words = [];
    for (let length = 3; length <= retries[attempt].max_letters; length++) {
        let current_found_words = []
        var cmb = Combinatorics.permutation(found_letters, length).toArray();

        for (let i = 0; i < cmb.length; i++) {
            let w = cmb[i].join('');
            if (words.indexOf(cmb[i].join('')) >= 0) {
                found_words.push(cmb[i].join(''));
                current_found_words.push(cmb[i].join(''));
            }
        }

        current_found_words = current_found_words.filter(function (item, pos) {
            return current_found_words.indexOf(item) == pos;
        });

        console.log(length + ' letters: ' + current_found_words.join(', '));
    }

    console.log();

    found_words = found_words.filter(function (item, pos) {
        return found_words.indexOf(item) == pos;
    });

    // Testing all words
    found_words_index = [];
    for (let w = 0; w < found_words.length; w++) {
        found_words_index[w] = [];

        for (let l = 0; l < found_words[w].length; l++) {
            let index = found_letters.indexOf(found_words[w][l]);
            let x = found_coordinates[index].x,
                y = found_coordinates[index].y;
            while (found_words_index[w].findIndex(function (element) {
                    return x == element.x && y == element.y
                }) > -1) {
                index = found_letters.indexOf(found_words[w][l], index + 1);
                x = found_coordinates[index].x;
                y = found_coordinates[index].y;
            };

            found_words_index[w].push({
                x: x,
                y: y
            })
        }
    }

    w = 0;

    console.log('Sending words');
    sendNextWord();
}


function sendNextWord() {
    let commands = [
        "touch down " + found_words_index[w][0].x + " " + found_words_index[w][0].y,
        "sleep 40",
    ];

    for (let l = 1; l < found_words_index[w].length; l++) {
        commands.push("touch move " + found_words_index[w][l].x + " " + found_words_index[w][l].y);
        commands.push("sleep 40");
    }

    commands.push("touch up " + found_words_index[w][found_words_index[w].length - 1].x + " " + found_words_index[w][found_words_index[w].length - 1].y);

    client.send(commands, function (err) {});

    if (++w < found_words_index.length) {
        setTimeout(sendNextWord, 700);
    } else {
        setTimeout(function () {
            console.log();
            console.log('Continue to next level')

            start();
        }, 13000)
    }
}

function start() {
    attempt = 0;

    gameId = moment(new Date()).format('YYYYMMDDHHmmss');
    fs.mkdir('output\\' + gameId, {
        recursive: true
    }, function (err) {
        if (err) {
            exit();
        }

        client.tap(539, 1770, function () {});

        setTimeout(play, 1000);
    });


    // setTimeout(function () {
    //     client.tap(872, 534, function () {});
    // }, 500);
}

function compare(score1, score2) {
    if (score1.length != score2.length) {
        return 10000000000000;
    }

    let length = 0;
    for (let s = 0; s < score1.length; s++) {
        length += Math.pow(score1[s] - score2[s], 2);
    }
    return Math.sqrt(length);
}

function checkForAd() {
    exec(IM + ' ' + (file == 'screen.png' ? 'output\\' + gameId + '\\' : '') + file + ' -crop 66x66+842+506 +repage -channel RGB -threshold 50%  +repage output\\' + gameId + '\\ad.png');

    let out = exec(IM + ' output\\' + gameId + '\\ad.png -gravity center -scale 6x6^! -compress none -depth 16 ppm:-');
    let a = out.toString().split('\n');
    let score = [];
    for (let k = 2; k < a.length; k++) {
        score.push.apply(score, a[k].split(' ').filter(Boolean));
    }

    let diff = compare(score, alphabet_scores['ad']);
    if (diff < 1000) {
        console.log('Found an ad - > closing.');
        client.tap(878, 536, function () {});
    }
}

function exit() {
    client.end();
    adb_process.kill();
    exec(ADB + ' shell killall com.android.commands.monkey &');
    console.log('Error occured while sending command. Exiting.');
    process.exit(1);
}

// Start
setTimeout(() => {
    client = monkey.connect({
        port: 1080
    });

    client.on('error', function () {
        exit();
    });

    start();
}, 1000);