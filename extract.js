const fs = require('fs');
const csv = require('csv-parser');
const url = require('url');
const Json2csvParser = require('json2csv').Parser;
const regexValues = require('./regex.js');
var dataToWrite = new Array;

if (process.argv.length <= 2) {
    console.log("Usage: " + __filename + " input_file.csv");
    process.exit(-1);
}

var param = process.argv[2];
var inputFilePath;

if (fs.existsSync(param)) {
    inputFilePath = param;
} else {
    console.error("Error: File '" + param + "' does not exist or is corrupt");
    process.exit(-1);
}

console.log("Preparing to extract features...");

fs.createReadStream(inputFilePath)
    .pipe(csv())
    .on('data', function (data) {
        try {
            console.log("Extracting features from URL: " + data.url);
            var features = extractFeatures(data.url);
            var row = {
                url: data.url,
                label: parseInt(data.label)
            };

            Object.assign(row, row, features);
            dataToWrite.push(row);
        } catch (err) {
            console.log("Something went wrong extracting features");
            process.exit(-1);
        }
    })
    .on('end', function () {
        outputResultCSV();
    });

function extractFeatures(urlIn) {
    var parsedUrl = url.parse("http://" + urlIn);

    //get host features
    var hostname = parsedUrl.host;
    var hostLength = hostname.length;
    var hostTokenCount = hostname.split(".").length;

    //get path features
    var pathname = parsedUrl.pathname;
    var pathLength = pathname.length;

    //get tokens in URL
    var delimiters = ["?", "=", "-", "_", "/", "%"];
    var totalTokenCount = getTokens(urlIn, delimiters).length;

    //get counts of characters in URL
    var letterCount = countLetters(urlIn);
    var numberCount = countNumbers(urlIn);
    var hyphenCount = countHyphens(urlIn);

    //aggregate features
    var features = {
        'host_length': hostLength,
        'host_token_count': hostTokenCount,
        'path_length': pathLength,
        'path_token_count': (totalTokenCount - hostTokenCount),
        'total_token_count': totalTokenCount,
        'letter_count': letterCount,
        'number_count': numberCount,
        'number_to_letter_ratio': (numberCount / letterCount),
        'hyphen_count': hyphenCount,
        'top_20_domain_in_path': containsTop20Domain(pathname),
        'top_10_tld_in_host': containsTop10tld(hostname),
        'shortening_service_used': shorteningServiceUsed(hostname)
    };

    return features;
}

function getTokens(str, delimiters) {
    var tempChar = delimiters[0];
    for (var i = 1; i < delimiters.length; i++) {
        str = str.split(delimiters[i]).join(tempChar);
    }
    return str.split(tempChar);
}

function countLetters(str) {
    return str.replace(/[^A-Z]/gi, "").length;
}

function countNumbers(str) {
    return str.replace(/[^0-9]/gi, "").length;
}

function countHyphens(str) {
    return str.replace(/[^-]/gi, "").length;
};

function shorteningServiceUsed(str) {
    var regex = regexValues.shortenedLinks;
    if ((str).search(regex) >= 0) {
        return 1
    } else {
        return 0
    }
}

function containsTop20Domain(str) {
    var regex = regexValues.alexaTop20;
    if (str.search(regex) >= 0) {
        return 1
    } else {
        return 0
    }
}

function containsTop10tld(str) {
    var regex = regexValues.tldTop10;
    if (str.search(regex) >= 0) {
        return 1
    } else {
        return 0
    }
}

function outputResultCSV() {
    var fields = [
        'url',
        'host_length',
        'host_token_count',
        'path_length',
        'path_token_count',
        'total_token_count',
        'letter_count',
        'number_count',
        'number_to_letter_ratio',
        'hyphen_count',
        'top_20_domain_in_path',
        'top_10_tld_in_host',
        'shortening_service_used',
        'label'
    ];

    const json2csvParser = new Json2csvParser({
        fields
    });
    const csv = json2csvParser.parse(dataToWrite);
    const filename = inputFilePath.split(".")[0] + "_features.csv";
    fs.writeFile(filename, csv, 'utf8', function (err) {
        if (err) {
            console.log('Error: File not saved or is otherwise corrupted');
        } else {
            console.log("Success: Output file '" + filename + "' generated successfully.");
        }
    });
}