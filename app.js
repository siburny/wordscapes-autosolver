const exec = require('child_process').execSync;
const fs = require('fs');
const Combinatorics = require('js-combinatorics');

// Arguments
var args = process.argv.slice(2);

// Consts
const file = args[0] || 'screen.png';
const max_letters = args[1] || 6;
const IM = '"c:\\Program Files\\ImageMagick-7.0.8-Q16\\convert.exe"';
const words = fs.readFileSync('words_alpha.txt').toString().split('\n').map(Function.prototype.call, String.prototype.trim);

// Load alphabet
const alphabet = ['a', 'b', 'c', 'd', 'e', 'g', 'i', 'k', 'l', 'm', 'n', 'o', 'r', 's', 't', 'u', 'v', 'y'];
var alphabet_scores = {};
for (let j = 0; j < alphabet.length; j++) {
    let out = exec(IM + ' letters\\' + alphabet[j] + '.png -gravity center -crop 80%% -scale 6x6^! -fx ".5+u-p{1,1}" -compress none -depth 16 ppm:-');

    let a = out.toString().split('\n');
    alphabet_scores[alphabet[j]] = [];
    for (let k = 2; k < a.length; k++) {
        alphabet_scores[alphabet[j]].push.apply(alphabet_scores[alphabet[j]], a[k].split(' ').filter(Boolean));
    }
}

// Get screenshot
if (file == 'screen.png') {
    exec('"c:\\Users\\Max\\AppData\\Local\\Android\\sdk\\platform-tools\\adb.exe" shell screencap -p /sdcard/screen.png');
    exec('"c:\\Users\\Max\\AppData\\Local\\Android\\sdk\\platform-tools\\adb.exe" pull /sdcard/screen.png');
    exec('"c:\\Users\\Max\\AppData\\Local\\Android\\sdk\\platform-tools\\adb.exe" shell rm /sdcard/screen.png');
}

// center
const X = 539,
    Y = 1809,
    R = 240,
    W = 140;

var quit = false;

var letters = 6;
var found_letters = [];
var found_coordinates = [];
for (let l = 0; l < letters; l++) {
    let x = Math.floor(X + R * Math.sin(l * 2 * Math.PI / letters) - W / 2);
    let y = Math.floor(Y - R * Math.cos(l * 2 * Math.PI / letters) - W / 2);

    exec(IM + ' ' + file + ' -crop ' + W + 'x' + W + '+' + x + '+' + y + ' +repage out' + l + '.png');

    let out = exec(IM + ' out' + l + '.png -gravity center -crop 80%% -scale 6x6^! -fx ".5+u-p{1,1}" -compress none -depth 16 ppm:-');
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

    if (pick_length < 40000) {
        console.log('Letter #' + l + ': ' + alphabet[pick_letter] + ' (' + pick_length + ')');
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

if (quit) {
    return;
}

console.log();

var found_words = [];
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

found_words = found_words.filter(function (item, pos) {
    return found_words.indexOf(item) == pos;
});

// Testing all words
var monkey = require('adbkit-monkey');
var client = monkey.connect({
    port: 1080
});

// Events
client.on('error', function () {
    console.log('Error occured while sending command. Exiting.');
    process.exit(1);
});

var found_words_index = [];
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

var w = 0;

function sendNextWord() {
    console.log('Sending word: ' + found_words[w]);
    let commands = [
        "touch down " + found_words_index[w][0].x + " " + found_words_index[w][0].y,
        "sleep 50",
        //"touch move " + found_words_index[w][0].x + " " + found_words_index[w][0].y,
        //"sleep 50",
    ];

    for (let l = 1; l < found_words_index[w].length; l++) {
        commands.push("touch move " + found_words_index[w][l].x + " " + found_words_index[w][l].y);
        commands.push("sleep 50");
    }

    commands.push("touch up " + found_words_index[w][found_words_index[w].length - 1].x + " " + found_words_index[w][found_words_index[w].length - 1].y);

    client.send(commands, function (err) {});

    if (++w < found_words_index.length) {
        setTimeout(sendNextWord, 500);
    } else {
        client.end();
    }
}
sendNextWord();