//code for splitting up the output of 1x1 split from rebanes website to multiple queue folders
//author: Skai256
//January 8th 2024

//edits map files and shit
const fs = require("fs")
const path = require("path")

const host = path.dirname(__filename)
const splitfrom = host + "\\splitter" //where to pull files from

//verify we can see path
if (fs.existsSync(splitfrom) === false) {
    console.log("splitfrom doesnt exist")
    return
}

//map sizes
var mx = 56
var mz = 31
var mapname = "narnia_upscaled"
var splitby = 3 //how many machines its running across

var splits = []
var csplit = 1

console.log("converting map")

var allfiles = fs.readdirSync(splitfrom)
var chunkat = Math.floor(allfiles.length / splitby) //how many maps before starting next chunk folder

//setup pre data
for (let i = 1; i <= splitby; i++) {
    var pathto = host + "\\chunk" + i

    if (fs.existsSync(pathto) === false) {
        console.log("chunk folder " + i + " doesnt exist")
        return
    }

    splits[i - 1] = [0, pathto]
}

//actually chunk the map and split into folders
for (let x = 0; x < mx; x++) {
    for (let z = 0; z < mz; z++) {
        var chunkstr = "_" + x + "_" + z
        var filename = mapname + chunkstr + ".nbt"
        var cchunk = splitfrom + "\\" + filename
        var splitdata = splits[csplit - 1]

        //move to next chunk
        if (splitdata[0] >= chunkat && csplit < splitby) {
            csplit++
            splitdata = splits[csplit - 1]
        }

        splitdata[0]++
        fs.copyFileSync(cchunk, splitdata[1] + "\\" + filename)
        fs.renameSync(splitdata[1] + "\\" + filename, splitdata[1] + "\\" + splitdata[0] + ".nbt")
        console.log(x + " " + z + " " + splitdata[0] + " " + splitdata[1] + "\\" + filename)
    }
}

console.log("converted")
