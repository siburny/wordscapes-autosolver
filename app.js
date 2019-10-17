const exec = require('child_process').execSync;
const execAsync = require('child_process').exec;
const fs = require('fs');
const Combinatorics = require('js-combinatorics');
const monkey = require('adbkit-monkey');

// Arguments
var args = process.argv.slice(2);

// Consts
const ADB = '"c:\\Users\\' + require("os").userInfo().username + '\\AppData\\Local\\Android\\sdk\\platform-tools\\adb.exe"';
const file = args[0] || 'screen.png';
const max_letters = args[1] || 6;
const IM = '"c:\\Program Files\\ImageMagick-7.0.8-Q16\\convert.exe"';
const words = fs.readFileSync('words_alpha.txt').toString().split('\n').map(Function.prototype.call, String.prototype.trim);

// Load alphabet
const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'v', 'w', 'y'];
var alphabet_scores = {};
for (let j = 0; j < alphabet.length; j++) {
    let out = exec(IM + ' letters\\' + alphabet[j] + '.png -gravity center -scale 6x6^! -fx ".5+u-p{1,1}" -compress none -depth 16 ppm:-');

    let a = out.toString().split('\n');
    alphabet_scores[alphabet[j]] = [];
    for (let k = 2; k < a.length; k++) {
        alphabet_scores[alphabet[j]].push.apply(alphabet_scores[alphabet[j]], a[k].split(' ').filter(Boolean));
    }
}

// Global vars
var found_words_index, found_words, client, w, attempt = 0, negate = false;

function play() {

    // Get screenshot
    if (file == 'screen.png') {
        exec(ADB + ' shell screencap -p /sdcard/screen.png');
        exec(ADB + ' pull /sdcard/screen.png');
        exec(ADB + ' shell rm /sdcard/screen.png');
    }

    // center
    const X = 539,
        Y = 1800,
        R = 240,
        W = 130;

    var quit = false;

    var found_letters = [];
    var found_coordinates = [];
    for (let l = 0; l < max_letters; l++) {
        let x = Math.floor(X + R * Math.sin(l * 2 * Math.PI / max_letters) - W / 2);
        let y = Math.floor(Y - R * Math.cos(l * 2 * Math.PI / max_letters) - W / 2);

        exec(IM + ' ' + file + ' -crop ' + W + 'x' + W + '+' + x + '+' + y + ' +repage ' + (negate ? '-channel RGB -negate' : '') + ' -white-threshold 10% -flatten -fuzz 5% -trim +repage out' + l + '.png');

        let out = exec(IM + ' out' + l + '.png -gravity center -scale 6x6^! -fx ".5+u-p{1,1}" -compress none -depth 16 ppm:-');
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
            console.log('Letter #' + l + ': ' + alphabet[pick_letter].toUpperCase() + ' (' + pick_length + ')');
            found_letters.push(alphabet[pick_letter]);
            found_coordinates[l] = {
                x: x + W / 2,
                y: y + W / 2
            };
        } else {
            console.log('Letter #' + l + ': NO match (' + pick_length + ')');
            quit = true;
        }
    }

    console.log();

    if (quit) {
        if (attempt++ > 4) {
            console.log();
            console.log('Give up')
            adb_process.kill();
            client.end();
            process.exit();
        } else {
            negate = !negate;

            console.log();
            console.log('Retry #' + attempt);

            client.tap(539, 1770, function (err) {
                client.tap(872, 534, function () {});
            });
            setTimeout(play, 5000);
            return;
        }
    }
    attempt = 0;

    console.log();

    found_words = [];
    for (let length = 3; length <= max_letters; length++) {
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
        "sleep 25",
    ];

    for (let l = 1; l < found_words_index[w].length; l++) {
        commands.push("touch move " + found_words_index[w][l].x + " " + found_words_index[w][l].y);
        commands.push("sleep 25");
    }

    commands.push("touch up " + found_words_index[w][found_words_index[w].length - 1].x + " " + found_words_index[w][found_words_index[w].length - 1].y);

    client.send(commands, function (err) {});

    if (++w < found_words_index.length) {
        setTimeout(sendNextWord, 400);
    } else {
        setTimeout(function () {
            console.log();
            console.log('Continue to next level')

            client.tap(539, 1770, function () {});

            setTimeout(play, 2000);
        }, 13000)
    }
}

// Prep
exec(ADB + ' shell killall com.android.commands.monkey &');
exec(ADB + ' forward tcp:1080 tcp:1080');
var adb_process = execAsync(ADB + ' shell monkey --port 1080');

client = monkey.connect({
    port: 1080
});

client.on('error', function () {
    client.end();
    adb_process.kill();
    exec(ADB + ' shell killall com.android.commands.monkey &');
    console.log('Error occured while sending command. Exiting.');
    process.exit(1);
});

// Start
play();