//code for sorting carpet totals for accounts to put in the README file
//author: Skai256
//March 18th 2024

//hardcoded layout of colours globally used
var layout = [
    "Pink",
    "Magenta",
    "Purple",
    "Blue",
    "Light Blue",
    "Cyan",
    "Green",
    "Lime",
    "Yellow",
    "Orange",
    "Red",
    "Brown",
    "Black",
    "Gray",
    "Light Gray",
    "White"
]

//accounts (manual data entry)
//would be cooler to do this in-game by requesting the statistics packet but the
//formatting for it in nmp is pretty bad, so this is how were rolling
var accounts = {
    //order copies the layout array (placed, broken)
    "Skai256": [
        [843053, 4087],
        [215890, 354],
        [393280, 2510],
        [958342, 32849],
        [520094, 7123],
        [1376318, 14794],
        [1388214, 9895],
        [392484, 7302],
        [1513321, 25271],
        [2304563, 16026],
        [1858644, 15369],
        [2917521, 17274],
        [6108008, 197312],
        [2464955, 53966],
        [5585479, 79686],
        [5896519, 131759]
    ],
    "monkeycatluna": [
        [610463, 4862],
        [142895, 1337],
        [187031, 3300],
        [646705, 39627],
        [711478, 27026],
        [1355944, 36297],
        [744416, 7426],
        [252062, 20350],
        [875861, 15770],
        [952578, 13338],
        [1125006, 25087],
        [1655805, 33006],
        [6060042, 297699],
        [4090332, 173115],
        [3683528, 92033],
        [5534088, 242868]
    ],
    "Connor16892": [
        [275510, 12695],
        [13990, 98],
        [88420, 3209],
        [413376, 72007],
        [419897, 20937],
        [2540272, 32873],
        [345981, 2205],
        [82312, 1517],
        [433865, 13746],
        [501267, 10672],
        [584683, 7845],
        [1330080, 16049],
        [5081431, 293298],
        [5090097, 182651],
        [4939406, 115358],
        [4491188, 217809]
    ],
}

var all = []

//setup all array
for (let i = 0; i < layout.length; i++) {
    all.push([0, 0, layout[i]]) //placed / broken / colour
}

//function needed due to all array as well
function formstring(data) {
    var str = ""
    var totalplaced = 0
    var totalbroken = 0

    for (let i = 0; i < data.length; i++) {
        var placed = data[i][0]
        var broken = data[i][1]

        str += data[i][2] + ": " + commas(placed) + " / " + commas(broken) + "\n"

        totalplaced += placed
        totalbroken += broken
    }

    str += "\nTotal: " + commas(totalplaced) + " / " + commas(totalbroken)

    return str
}

//from internals
function commas(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

console.clear() //just incase

var accountkeys = Object.keys(accounts)

for (let i = 0; i < accountkeys.length; i++) {
    var key = accountkeys[i]

    //add the colour to all totals before sorting and forming string
    for (let x = 0; x < accounts[key].length; x++) {
        accounts[key][x].push(layout[x])

        //also sneak in adding up overall total here
        all[x][0] += accounts[key][x][0]
        all[x][1] += accounts[key][x][1]
    }

    //sort by placed of each colour
    accounts[key].sort(function (a, b) { return b[0] - a[0] })

    //actual part that goes in the readme
    var str = "### " + key + ":\n\n"

    str += formstring(accounts[key])

    console.log(str)
    console.log("\n")
}

//same sort
all.sort(function (a, b) { return b[0] - a[0] })

//output combined totals
console.log("### Combined Totals:\n")
console.log(formstring(all))
