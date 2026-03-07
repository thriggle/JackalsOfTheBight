const fs = require('fs');

const hexMap = {
    "moltke": "0529",
    "kernal": "0626",
    "askigaak": "0629",
    "shen-yang": "0727",
    "norg": "0729",
    "sultana": "0730",
    "qevar": "0731",
    "imone": "0826",
    "skopyeh": "0827",
    "burnham": "0828",
    "sipedon": "0929",
    "arnyl": "0930",
    "bukit-seng": "0831",
    "prege": "1030",
    "frisgar": "1026",
    "burtrum": "1126",
    "taburi-nen": "1227",
    "dekha": "1128",
    "bishop": "1226",
    "medard": "1327",
    "kew": "1426",
    "condamine": "1428",
    "ishiri": "1429",
    "eretaro": "1430",
    "djar": "1229",
    "point-ay": "1231",
    "briaxis": "0531",
    "agdarmi": "0526", // Fudged off-map top left
    "hrd": "1431", // Fudged off-map bottom right
    "jecife": "1331", // Fudged off-map bottom right
    "kubishush": "1427", // Fudged
    "liiri": "1326", // Fudged
    "magash": "1328", // Fudged
    "malea": "0631", // Fudged
    "rhinom": "0630"  // Fudged
};

const dataPath = './data/worlds.json';
const worlds = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

worlds.forEach(w => {
    if (hexMap[w.id]) {
        w.hex = hexMap[w.id];
    }
});

fs.writeFileSync(dataPath, JSON.stringify(worlds, null, 2));
console.log('Hexes appended to worlds.json');
