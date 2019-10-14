const exec = require('child_process').execSync;
const fs = require('fs');
const Combinatorics = require('js-combinatorics');

// Arguments
var args = process.argv.slice(2);

// Consts
const file = args[0] || 'c:\\Projects\\nodejs\\wordscapes\\Screenshot_20191013-214455.jpg';
const max_letters = args[1] || 6;
const IM = '"c:\\Program Files\\ImageMagick-7.0.8-Q16\\convert.exe"';
const words = fs.readFileSync('words_alpha.txt').toString().split('\n').map(Function.prototype.call, String.prototype.trim);

// Load alphabet
const alphabet = ['c', 'e', 'g', 'i', 'k', 'l', 'm', 'o', 'r', 's', 't', 'u', 'y'];
var alphabet_scores = {};
for (let j = 0; j < alphabet.length; j++) {
    let out = exec(IM + ' letters\\' + alphabet[j] + '.png -gravity center -crop 80%% -scale 6x6^! -fx ".5+u-p{1,1}" -compress none -depth 16 ppm:-');

    let a = out.toString().split('\n');
    alphabet_scores[alphabet[j]] = [];
    for (let k = 2; k < a.length; k++) {
        alphabet_scores[alphabet[j]].push.apply(alphabet_scores[alphabet[j]], a[k].split(' ').filter(Boolean));
    }
}

// center
const X = 539,
    Y = 1729,
    R = 240,
    W = 140;

var quit = false;

var letters = 6;
var found_letters = [];
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

    if (pick_length < 100000) {
        console.log('Letter #' + l + ': ' + alphabet[pick_letter] + ' (' + pick_length + ')');
        found_letters.push(alphabet[pick_letter]);
    } else {
        console.log('Letter #' + l + ': NO match');
        quit = true;
    }
}

if (quit) {
    return;
}

for (let length = 3; length <= max_letters; length++) {
    var found_words = [];
    var cmb = Combinatorics.permutation(found_letters, length).toArray();

    for (let i = 0; i < cmb.length; i++) {
        let w = cmb[i].join('');
        if (words.indexOf(cmb[i].join('')) >= 0) {
            found_words.push(cmb[i].join(''));
        }
    }

    found_words = found_words.filter(function (item, pos) {
        return found_words.indexOf(item) == pos;
    });
    console.log(length + ' letters: ' + found_words.join(', '));
}