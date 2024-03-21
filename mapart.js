//fully automated flat carpet map art creation for mineflayer on 2b2t
//author: Skai256
//December 23rd 2023

const public = {
    "description": "Automated flat carpet map art creation",

    "state": "none",
    "decidetowipe": false,
    "pathfailing": 0,
    "sequence": 0, //who added this to the packets, why does it exist?

    //generic settings
    "config": {
        "wipewhenfinishedall": true, //clear board when out of schematic files to build
        "alwayschoosetowipe": false, //always wipe map when moving onto next schem, leave false for saving check
        "renamemaps": true //search files for a name json to rename
    },

    //info about the map art platform first logged in at
    "info": undefined,
    "listenergrid": undefined
}

public.init = function (Skainet) {
    //core modules
    const fs = Skainet.imports.fs
    const Vec3 = Skainet.imports.Vec3

    //this is here because the carpet duper stations change directions and i cannot be assed to deal with that
    var optimizelayout = [
        "pink_carpet",
        "magenta_carpet",
        "purple_carpet",
        "blue_carpet",
        "light_blue_carpet",
        "cyan_carpet",
        "green_carpet",
        "lime_carpet",
        "yellow_carpet",
        "orange_carpet",
        "red_carpet",
        "brown_carpet",
        "black_carpet",
        "gray_carpet",
        "light_gray_carpet",
        "white_carpet"
    ]

    //try changing the order of these around and watch how much the building changes :troll:
    var cardinals = [
        new Vec3(0, 0, -1),
        new Vec3(-1, 0, 0),
        new Vec3(0, 0, 1),
        new Vec3(1, 0, 0)
    ]

    //even though in cases where an actual dc happens and bot obj is remade, this is still needed due to actions system
    public.gridcleanup = function () {
        if (typeof public.listenergrid == "object") {
            var keys = Object.keys(public.listenergrid)
            console.log("listener grid cleanup " + keys.length)

            for (let i = 0; i < keys.length; i++) {
                Skainet.mods.Mineflayer.bot.world.off(keys[i], public.listenergrid[keys[i]][0])
            }
        }

        public.listenergrid = undefined
    }

    //external
    public.reset = function (bot) {
        if (Skainet.mods.Mineflayer.flags.status === "off") {
            public.sequence = 0
        }

        clearTimeout(public?.restocktimeout)
        public.gridcleanup()
    }

    //move to internals module at some point?
    public.stringtovec3 = function (vecstr) {
        var cstrpos = vecstr.substring(1)
        cstrpos = cstrpos.substring(0, cstrpos.length - 1)

        var coords = cstrpos.split(", ")

        return new Vec3(parseFloat(coords[0]), parseFloat(coords[1]), parseFloat(coords[2]))
    }

    //called externally by actions handler
    public.start = async function () {
        var selfseed = Skainet.actionseed
        var bot = Skainet.mods.Mineflayer.bot //for my sanity

        //this condition will be checked after every situation where time has passed
        function seedcheck() {
            return Skainet.actionseed === selfseed && Skainet.mods.Mineflayer.flags.status === "on"
        }

        if (!seedcheck()) { return }

        //a lot of cases where infinite awaiting trips this, i dont like this solution and eventually need to properly handle
        //all of the cases, but this works for now
        public.restockcheck = function () {
            if (!seedcheck()) { return }

            Skainet.mods.Actions.actionfail("Intentional disconnect due to stuck somewhere", true, true)
            return
        }

        //important for keeping track of schem progress
        //schem progress is only kept track of for the number of remaining carpet colours
        function genlistenergrid() {
            public.gridcleanup()
            public.listenergrid = {}

            var eventsat = Object.keys(public.info.currentbuild.blocks)

            //grid of blockupdate events was done instead of blockupdate listener due to carpet dupers actually straining the entire thread
            //i was legit watching like an 8 second delay between block break and console print during initial write lol
            for (let i = 0; i < eventsat.length; i++) {
                let atstr = eventsat[i]
                let eventstr = "blockUpdate:" + atstr

                public.listenergrid[eventstr] = [(oldblock, newblock) => {
                    if (!seedcheck()) { return }

                    let shouldbe = public.info.schem.palette[public.info.currentbuild.blocks[atstr]]
                    let state = public.listenergrid[eventstr][1]

                    if (state === false && (oldblock?.type == shouldbe && newblock?.type == 0)) {
                        public.info.currentbuild.palette[shouldbe]++
                        public.info.currentbuild.remaining++
                        public.listenergrid[eventstr][1] = true
                        console.log("BLOCK CHANGED TO AIR FROM CORRECT " + atstr) //crazy? i was crazy once
                    } else if (state === true) {
                        if (newblock?.type == shouldbe) {
                            public.info.currentbuild.palette[shouldbe]--
                            public.info.currentbuild.remaining--
                            public.listenergrid[eventstr][1] = false
                            //console.log("correct at " + atstr + " " + bot.registry.blocks[shouldbe].name + " " + public.info.currentbuild.remaining)
                            //} else {
                            //console.log("INCORRECT at " + atstr + " " + newblock?.name + " | " + bot.registry.blocks[shouldbe].name)
                        }
                    }
                }, bot.blockAt(public.stringtovec3(atstr))?.type !== public.info.schem.palette[public.info.currentbuild.blocks[atstr]]]

                //tbh theres a chance that the bot can dc from the server before this packet is sent and desync the clientsided progress
                //thats why in grabbing carpets <= -1 is still seen as acceptable and is forced to 1
                //since ive seen connors account enter an infinite loop of walking back and forth to grab a carpet colour that desynced
                //so it never actually grabbed the colour it needed to finish what it started
                bot.world.on(eventstr, public.listenergrid[eventstr][0])
            }
        }

        //used in different spots depending on case
        async function disablelever() {
            var lever = bot.blockAt(public.info.lever)

            if (lever?._properties?.powered === true) {
                await safegoto(public.info.pane)
                if (!seedcheck()) { return }

                await bot.lookAt(lever.position.offset(0.5, 0.5, 0.5))
                await Skainet.mods.Internals.wait(0.5)
                if (!seedcheck()) { return }

                await bot.activateBlock(lever)
                await Skainet.mods.Internals.wait(7.5) //added wait so we try not to unload the redstone
                if (!seedcheck()) { return }

                console.log("carpet dupers disabled, finished building")
            }
        }

        //speed
        async function fastequip(item) {
            var item = bot.registry.itemsByName[item]?.id

            if (bot.heldItem?.type === item) { return true } //were already holding the same item id, no need to swap

            var itemobj = Skainet.mods.Mineflayer.finditemininventory(item)

            if (itemobj === false) { return false } //we just dont have the item

            //item is on our hotbar so just move our quick slot to it
            if (itemobj.slot >= Skainet.mods.Mineflayer.quickstart) {
                await bot.setQuickBarSlot(itemobj.slot - Skainet.mods.Mineflayer.quickstart)
            } else { //heres where shit sucks, we have the item and its not in our hotbar, so we HAVE to grab it from our inventory and move it
                //here we need to pick an optimal hotbar slot to swap the item out of our inventory into
                //over anything we prefer an empty slot, however as we read the hotbar we will ignore items weve seen for the first time
                //and choose a slot if they appear again, otherwise we pick the last hotbar slot as theres no ideal picks
                var seen = {}
                var idealslot = undefined

                //find ideal slot
                for (let i = 36; i <= 44; i++) {
                    idealslot = i
                    var itemat = bot.inventory.slots[i]

                    if (itemat == undefined) { break } //blank slot
                    if (typeof seen[itemat.name] == "boolean") { break } //we want as many unique items on the hotbar as possible, so prefer repeats
                    if (public.info.usecostsystem === true && public.info.costs[itemat.name] >= 15) { break } //if we havent used the colour in more than 15 loops, we prefer it as well
                    seen[itemat.name] = true
                }

                //idealslot will always end at 44 if we found absolutely nothing
                idealslot -= Skainet.mods.Mineflayer.quickstart //convert to hotbar slot

                var swappingoff = JSON.stringify(bot?.heldItem ?? {}) //we log the item (totally reliable and not jank solution)
                var timeoutbeinghit = 0

                bot.clickWindow(itemobj.slot, idealslot, 2)
                bot.setQuickBarSlot(idealslot) //obviously need to move to it as it might not be the same

                //i fucking hate this solution but theres no packet to listen for server response and helditem desyncs because mineflayer is a shit
                while (timeoutbeinghit <= 50) {
                    bot.updateHeldItem()

                    await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 3000, 1)
                    if (swappingoff != JSON.stringify(bot?.heldItem ?? {})) { break }

                    timeoutbeinghit++
                }
            }

            return true
        }

        //get missing carpets within reach of the bot
        function getmissingneighbours(cpos) {
            var botat = Skainet.mods.Internals.fixpos(bot.entity)
            var closedset = {}
            var inopenset = {}
            var banned = {}
            var open = [cpos]
            var missingnearby = []
            inopenset[cpos.toString()] = true

            while (open.length > 0) {
                var cspot = open.shift()
                var cstr = cspot.toString()
                closedset[cstr] = true
                delete inopenset[cstr]

                for (let i = 0; i < cardinals.length; i++) {
                    var newpos = cspot.offset(cardinals[i].x, cardinals[i].y, cardinals[i].z)
                    var newstr = newpos.toString()

                    if (typeof closedset[newstr] == "boolean") { continue }

                    //out of reach
                    if (newpos.distanceTo(botat) >= Skainet.maxreach) { continue }

                    //weve hit the borders of the map art area and should stop
                    if (typeof public.info.currentbuild.inbounds[newstr] != "boolean") { continue }

                    var binfo = bot.blockAt(newpos)

                    if (binfo == null) { continue } //were going out of render distance so just stop

                    if (typeof inopenset[newstr] != "boolean") {
                        open.push(newpos) //add it as a valid spot to search neighbours off of
                        inopenset[newstr] = true
                    }

                    var schemdata = public.info.currentbuild.blocks[newstr]

                    if (typeof schemdata != "number") { continue }

                    //pick the block that is in loaded chunks, in bounds of the schem, and isnt the proper state
                    if (binfo.type != public.info.schem.palette[schemdata] && typeof banned[newstr] == "undefined") {
                        //console.log("missing neighbour " + newpos.toString())
                        missingnearby.push(newpos)
                        banned[newstr] = true
                    }
                }
            }

            return missingnearby
        }

        //get nearest missing carpet in the map relative to bot pos
        function getnearestmissing(cpos) {
            //figure out the most amount of missing block in the schem
            var tosort = undefined

            //on the very first
            if (public.info.atcarpetduper === true) {
                tosort = []
                var keys = Object.keys(public.info.currentbuild.palette)

                for (let i = 0; i < keys.length; i++) {
                    var blockid = keys[i]
                    tosort.push([blockid, public.info.currentbuild.palette[blockid]])
                }

                tosort.sort(function (a, b) { return b[1] - a[1] })
            }

            //find nearest missing block
            var closedset = {}
            var inopenset = {}
            var open = [cpos]
            var picking = undefined
            inopenset[cpos.toString()] = true

            while (open.length > 0) {
                var cspot = open.shift()
                var cstr = cspot.toString()
                closedset[cstr] = true
                delete inopenset[cstr]

                for (let i = 0; i < cardinals.length; i++) {
                    var newpos = cspot.offset(cardinals[i].x, cardinals[i].y, cardinals[i].z)
                    var newstr = newpos.toString()

                    if (typeof closedset[newstr] == "boolean") { continue }

                    //weve hit the borders of the map art area and should stop
                    if (typeof public.info.currentbuild.inbounds[newstr] != "boolean") { continue }

                    var binfo = bot.blockAt(newpos)

                    if (binfo == null) { continue } //were going out of render distance so just stop

                    if (typeof inopenset[newstr] != "boolean") {
                        open.push(newpos) //add it as a valid spot to search neighbours off of
                        inopenset[newstr] = true
                    }

                    var schemdata = public.info.currentbuild.blocks[newstr]

                    if (typeof schemdata != "number") { continue }

                    var shouldbe = public.info.schem.palette[schemdata]

                    //pick the block that is in loaded chunks, in bounds of the schem, and isnt the proper state
                    //note that in the case that it isnt air we need to also destroy it
                    if (binfo.type != shouldbe) {
                        //we just prefer closest missing
                        if (tosort == undefined) {
                            //console.log("found nearest missing " + newpos.toString())
                            return newpos
                        }

                        //on first run out of the carpet duper we 100% prefer to find the nearest greatest missing carpet
                        //that way we have a better chance of continuing in a bigger area
                        //however we dont prefer to do this again to reduce needless backtracking as
                        //the carpet numbers balance out and the largest constantly swaps around
                        if (shouldbe == tosort[0][0]) {
                            //console.log("found nearest LARGEST missing " + newpos.toString())

                            return newpos
                        } else {
                            //keep track of this pos as missing incase for some reason we dont find the other one
                            //should never happen under normal circumstances though so wtf lol
                            picking = newpos
                        }
                    }
                }
            }

            //console.log("nearest missing exhausted")
            return picking
        }

        function outofbounds() {
            //these variables arent needed, cry about it
            var x = public.info.chunkx * 128
            var z = public.info.chunkz * 128

            return typeof public.info.schem.blocks[x + "," + z] != "number"
        }

        function schemfromchunk() {
            var x = public.info.chunkx * 128
            var z = public.info.chunkz * 128

            var schem = {
                "blocks": {},
                "palette": {}, //note that this is not to be referenced against, this is only to optimize carpet grabbing for the chunk
                "inbounds": {}, //all block coords within the building space
                "needschecking": {},
                "remaining": 16384
            }

            //in this case the chunk is out of bounds, so we know weve hit the end of that specific row
            if (typeof public.info.schem.blocks[x + "," + z] != "number") {
                return undefined
            }

            //generate schem object on real coords of what were building based off of the chunking coords
            for (let xs = 0; xs < 128; xs++) {
                for (let zs = 0; zs < 128; zs++) {
                    var schemx = x + xs
                    var schemz = z + zs
                    var schemdata = public.info.schem.blocks[schemx + "," + schemz]
                    var atcoords = public.info.startpos.offset(xs, 0, zs) //we subtract our extra offset when placing it on the platform
                    var atstr = atcoords.toString()

                    schem.blocks[atstr] = schemdata
                    schem.inbounds[atstr] = true

                    //pallete for the chunk (only used for decisions made on grabbing carpet)
                    var paletteblock = public.info.schem.palette[schemdata]

                    if (typeof schem.palette[paletteblock] != "number") {
                        schem.palette[paletteblock] = 1
                    } else {
                        schem.palette[paletteblock]++
                    }

                    //is there a block already placed there on the server?
                    var schemat = bot.blockAt(atcoords)

                    if (schemat?.type !== bot.registry.blocksByName.air.id) {
                        schem.needschecking[atstr] = true
                    }
                }
            }

            return schem
        }

        //ugly wrapper for my pathfinder movement engine, quite literally fakes astar path node output :mdma:
        async function safegoto(vec3pos, noretry = false) {
            var tries = 0

            while (seedcheck() === true) {
                var walked = await Skainet.mods.Pathfinder.gotoonce(vec3pos, selfseed) //this has server teleport checks now, hopefully more stable
                var startwait = Skainet.mods.Internals.ctime()

                await Skainet.mods.Internals.oncetimeout(bot._client, "packet", 33000, 1) //make sure server isnt retarded

                if (walked != 0) {
                    tries++

                    //lag back, teleport during walking, etc
                    if (Skainet.mods.Pathfinder.forcemoved === true) {
                        console.log("safegoto reset tries to 1 due to forcedmove")
                        tries = 1
                    }

                    if (tries >= 4) {
                        //we only perm logout if this keeps repeating
                        public.pathfailing++
                        Skainet.mods.Actions.actionfail("Map art safegoto failed to reach destination after 4 tries (" + public.pathfailing + " global)", public.pathfailing < 3)
                        return
                    } else if (tries >= 3 && noretry === false) {
                        console.log("safegoto resorting to backtracking to try to fix")
                        await safegoto(public.info.center, true)
                        if (!seedcheck()) { return }
                    }

                    if (!seedcheck()) { return }
                    console.log("pathing failing " + tries + " | forcing jump to try to unstuck")
                    bot.setControlState("jump", true)
                    await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 3000, 1)
                    bot.setControlState("jump", false)
                } else if (Skainet.mods.Internals.secondssince(startwait) <= 3) {
                    break //arrived and server is roughly confirmed not retarded
                }
            }

            public.pathfailing = 0 //reset flag
            return true
        }

        //used in restocking
        async function finddubfromglowstone(glowstones, search) {
            for (let i = 0; i < glowstones.length; i++) {
                var glowpos = glowstones[i]
                var glowblock = bot.blockAt(glowpos.offset(0, 2, 0))

                if (glowblock != null && glowblock?.type == search) {
                    for (let z = 0; z < cardinals.length; z++) {
                        var bpos = glowpos.offset(cardinals[z].x, cardinals[z].y, cardinals[z].z)
                        var bdata = bot.blockAt(bpos)

                        if (bdata?.type === bot.registry.blocksByName.crying_obsidian.id) {
                            var result = await safegoto(bdata.position.offset(0, 1, 0))

                            if (!result) { return }

                            //open the trapped chest and return the window object
                            var chestat = bot.blockAt(glowpos.offset(0, 1, 0))

                            if (!chestat || chestat?.type != bot.registry.blocksByName.trapped_chest.id) {
                                Skainet.mods.Actions.actionfail("Block at glowstone was not a trapped chest")
                                return
                            }

                            //look at the chest
                            await bot.lookAt(chestat.position.offset(0.5, 0.5, 0.5), true) //offset to look at center of the chest block
                            await Skainet.mods.Internals.wait(0.5)
                            if (!seedcheck()) { return }

                            //we need this for the surface
                            var blockat = bot.blockAtCursor(Skainet.maxreach)

                            if (!blockat) {
                                //this can fail due to being lagged back by the server and the raycast just goes through air
                                Skainet.mods.Actions.actionfail("No block at cursor during glowstone chest opening", true)
                                return
                            }

                            //return window
                            var window = await bot.openContainer(chestat, Skainet.mods.Mineflayer.facetodirection(blockat.face))
                            await Skainet.mods.Internals.wait(0.5)
                            return window
                        }
                    }

                    Skainet.mods.Actions.actionfail("Glowstone has no walkable crying obsidian")
                    return
                }
            }

            Skainet.mods.Actions.actionfail("Map art glowstone search failed")
            return
        }

        //actual bot process
        public.runtime = async function () {
            //forcing bot to walk to center after finishing map
            if (public.state == "forcecenter") {
                console.log(public.state)

                await safegoto(public.info.center) //has to be here to get accurate blockat info (this doesnt matter on 2b tbh)
                await Skainet.mods.Internals.wait(3)
                if (!seedcheck()) { return }

                //we determined the previous map was completed so we have to intentionally force a reload of everything
                //little bit ugly but does verify integrity of map art station
                if (typeof public.info.selfwipe == "boolean") {
                    delete public.info
                }

                public.state = "loadschemchunk"
            }

            //we are expecting the bot to start at the CENTER of the map art platform during this
            if (public.info == undefined) {
                var gotoblock = bot.findBlock({
                    matching: bot.registry.blocksByName.diamond_block.id,
                    maxDistance: 16
                })

                if (!gotoblock) {
                    Skainet.mods.Actions.actionfail("Bot is not on map art platform or centered with it")
                    return
                }

                var dispenser = bot.blockAt(gotoblock.position.offset(-1, 0, 0))

                if (!dispenser || dispenser?.type != bot.registry.blocksByName.dispenser.id) {
                    Skainet.mods.Actions.actionfail("Diamond block doesnt have dispenser where expected")
                    return
                }

                var enddispenser = bot.blockAt(dispenser.position.offset(0, 0, 56))

                if (!enddispenser || enddispenser?.type != bot.registry.blocksByName.dispenser.id) {
                    Skainet.mods.Actions.actionfail("End dispenser doesnt exist")
                    return
                }

                var startdispenser = bot.blockAt(dispenser.position.offset(0, 0, -64))

                if (!startdispenser || startdispenser?.type != bot.registry.blocksByName.dispenser.id) {
                    Skainet.mods.Actions.actionfail("Start dispenser doesnt exist")
                    return
                }

                var pane = bot.blockAt(gotoblock.position.offset(0, 0, -1))

                if (!pane || pane?.type != bot.registry.blocksByName.glass_pane.id) {
                    Skainet.mods.Actions.actionfail("Diamond block doesnt have glass pane where expected")
                    return
                }

                var lever = bot.blockAt(pane.position.offset(0, -1, 0))

                if (!lever || lever?.type != bot.registry.blocksByName.lever.id) {
                    Skainet.mods.Actions.actionfail("Glass pane doesnt have lever where expected")
                    return
                }

                var startpos = bot.blockAt(gotoblock.position.offset(-64, 0, -64))

                if (!startpos || startpos?.type != bot.registry.blocksByName.iron_block.id) {
                    Skainet.mods.Actions.actionfail("Diamond block doesnt have iron block corner where expected")
                    return
                }

                var emeralds = [
                    //dont disturb order here, hard coded check on index 1 for catography table station + renaming
                    [gotoblock.position.offset(65, 0, 0), new Vec3(-1, 0, 0)], //east middle
                    [gotoblock.position.offset(-1, 0, 65), new Vec3(0, 0, -1)], //south middle
                    [gotoblock.position.offset(-66, 0, -1), new Vec3(1, 0, 0)], //west middle

                    //extras added later
                    [gotoblock.position.offset(-66, 0, -41), new Vec3(1, 0, 0)], //north west middle
                    [gotoblock.position.offset(-66, 0, 39), new Vec3(1, 0, 0)], //south west middle

                    [gotoblock.position.offset(65, 0, -40), new Vec3(-1, 0, 0)], //north east middle
                    [gotoblock.position.offset(65, 0, 40), new Vec3(-1, 0, 0)], //south east middle

                    [gotoblock.position.offset(-41, 0, 65), new Vec3(0, 0, -1)], //south west middle
                    [gotoblock.position.offset(39, 0, 65), new Vec3(0, 0, -1)] //south east middle
                ]

                //sanity check all restocking stations
                for (let i = 0; i < emeralds.length; i++) {
                    var data = bot.blockAt(emeralds[i][0])

                    if (data.type != bot.registry.blocksByName.emerald_block.id) {
                        Skainet.mods.Actions.actionfail("Diamond block doesnt match up with emerald " + (i + 1))
                        return
                    }

                    emeralds[i] = {
                        "locked": 0,
                        "position": data.position.clone(),
                        "offset": emeralds[i][1]
                    }
                }

                //reset data if old is considered junk, junk is set true when absolutely everything is finished
                if (Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].junk === true) {
                    console.log("junk mapart json, resetting")
                    Skainet.mods.JsonHandler.overwrite(Skainet.account + "Mapart", {
                        "current": 1,
                        "x": 0,
                        "z": 0,
                        "junk": false
                    })
                } else {
                    console.log("mapart json not junk")
                }

                //primary obj
                public.info = {
                    "center": gotoblock.position.offset(0, 1, 0),
                    "dispenser": dispenser.position.offset(0, 1, 0),
                    "enddispenser": enddispenser.position.offset(0, 1, 0),
                    "startdispenser": startdispenser.position.offset(0, 1, 0),
                    "pane": pane.position.offset(0, 1, 0),
                    "lever": lever.position.clone(),
                    "startpos": startpos.position.offset(0, 1, 0),
                    "carpets": emeralds,
                    "currentfile": Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].current.toString(),
                    "lastdupervisit": -1,
                    "atcarpetduper": false,
                    "costs": {},
                    "usecostsystem": false,
                    "desyncfails": 0,

                    //in the event of a crash, these numbers dictate which chunk of the map is being built
                    "chunkx": Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].x,
                    "chunkz": Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].z
                }

                //this is done here cause the order of operations is a little fucked up
                if (!fs.existsSync(Skainet.madir + "\\" + public.info.currentfile + ".nbt")) {
                    Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].junk = true //flags to reset next run
                    Skainet.mods.JsonHandler.overwrite(Skainet.account + "Mapart")

                    //we should wipe the platform after were done all schems
                    if (public.config.wipewhenfinishedall === true) {
                        console.log("wiping because all schems done")
                        public.info.cleanupwipe = true
                        public.state = "wiping"
                        public.runtime()
                    } else {
                        await disablelever()
                        if (!seedcheck()) { return }
                        Skainet.mods.Actions.actionfail("Done building maps, not wiping platform due to config")
                        return
                    }

                    return
                }

                //external proper module finally, this was handled so poorly before tbh
                var mdata = await Skainet.mods.Schematic.loadschem(public.info.currentfile, Skainet.madir, "nbt", false, true)

                //sanity check that file is not retarded
                if (mdata?.size[1] != 3) {
                    Skainet.mods.Actions.actionfail("Map art file invalid y: " + mdata?.size[1])
                    return
                }

                //basically we should only have carpet and cobblestone in the palette
                var cobblestone = undefined

                for (let i = 0; i < mdata.palette.length; i++) {
                    var cblock = mdata.palette[i].Name

                    if (!cblock.endsWith("_carpet")) {
                        if (cblock == "minecraft:cobblestone") {
                            cobblestone = i
                            continue
                        }

                        Skainet.mods.Actions.actionfail("Map art file invalid block: " + cblock)
                        return
                    }
                }

                //no rebane mapartcraft? settings issue?
                if (cobblestone == undefined) {
                    Skainet.mods.Actions.actionfail("Map art file has no cobblestone noob line")
                    return
                }

                var rawdata = {
                    "blocks": {},
                    "palette": [],

                    //only used for rename checking
                    "width": mdata.size[0],
                    "length": mdata.size[2]
                }

                //this reformats nbt into my rawdata format so the schem is easier to create, this also removes the
                //noobline rebane FORCES you to build so the math isnt autistic as shit
                for (let i = 0; i < mdata.blocks.length; i++) {
                    var blockatdata = mdata.blocks[i]

                    //skip unneeded stuff
                    if (blockatdata.state === cobblestone || blockatdata.pos[1] != 2) { continue }

                    //we subtract 1 from z to offset the noobline out of the coordinates
                    rawdata.blocks[blockatdata.pos[0] + "," + (blockatdata.pos[2] - 1)] = blockatdata.state
                }

                //convert palette into mineflayer ids
                //note that this keeps the cobblestone so it doesnt desync the fuck out of everything
                for (let i = 0; i < mdata.palette.length; i++) {
                    var cdata = mdata.palette[i].Name.substring(10) //substring to remove minecraft:
                    var data = bot.registry.blocksByName[cdata]?.id

                    if (typeof data != "number") {
                        Skainet.mods.Actions.actionfail("Map art file contains a block in the palette that isnt in registry: " + cdata)
                        return
                    }

                    rawdata.palette.push(data)
                }

                public.info.schem = rawdata

                console.log("platform recognised and map art loaded into memory")

                //wait a bit because all the stuff above is hard on the thread lol
                await Skainet.mods.Internals.wait(5)

                //at this point this is the first run and we know were at the center, so time to do some setup stuff
                //turn on carpet dupers if off
                if (lever?._properties?.powered === false) {
                    await safegoto(public.info.pane)
                    if (!seedcheck()) { return }

                    await bot.lookAt(lever.position.offset(0.5, 0.5, 0.5))
                    await Skainet.mods.Internals.wait(0.5)
                    if (!seedcheck()) { return }

                    await bot.activateBlock(lever)
                    await Skainet.mods.Internals.wait(1)
                    if (!seedcheck()) { return }

                    console.log("carpet dupers enabled")
                }

                //console.log(cschem.blocks)
                //console.log(Object.keys(cschem.blocks).length)
                //console.log(cschem.palette)
                public.state = "loadschemchunk"
            }

            //load 128x128 chunk of schem and decide wiping shit
            if (public.state == "loadschemchunk") {
                console.log(public.state)
                //get initial schem for building
                var cschem = schemfromchunk()

                if (cschem == undefined) {
                    Skainet.mods.Actions.actionfail("Map is out of bounds on load schem chunk")
                    return
                }

                //here we compare on first run with whats already on the platform on 2b, this normally should be wiped but in the event
                //of a power outage and we want to resume, this stuff needs to be curated through here
                var nonairblocks = Object.keys(cschem.needschecking)
                var correct = []

                for (let i = 0; i < nonairblocks.length; i++) {
                    var schemcheckat2 = bot.blockAt(public.stringtovec3(nonairblocks[i]))
                    var palettepos = cschem.blocks[nonairblocks[i]]
                    var paletteid = public.info.schem.palette[palettepos]

                    if (schemcheckat2?.type === paletteid) {
                        correct.push([nonairblocks[i], palettepos])
                    }
                }

                /*12384 is just a nice rounded off number of where the cost of breaking and placing the incorrect carpets no longer becomes
                worth it simply due to placing time + breaking time, this number cannot factor in time spent travelling across
                the map due to many various reasons, and still may not be efficient in some cases due to travel backtracking
                but its safe to say a good percentage of the time this many correct pixels being recycled is better on time

                note these numbers cant factor in walking, inventory grabbing etc
                0.15 break
                0.05 place
                0.2 both

                16384 place costs 819.2 seconds
                16384 break costs 2457.6 seconds
                16384 place + break costs 3276.8 seconds

                4000 at 0.2 (placing + breaking) costs 800 seconds

                this could probably be tuned better, but for the sake of this it works and im happy with it
                */

                if (public.decidetowipe === true && (public.config.alwayschoosetowipe === true || correct.length <= 12384)) {
                    console.log("wiping map with " + correct.length + " / 16384")
                    public.state = "wiping"
                } else {
                    console.log("not wiping map, correcting schem")

                    for (let i = 0; i < correct.length; i++) {
                        var correctdata = correct[i]

                        cschem.palette[public.info.schem.palette[correctdata[1]]]--
                        cschem.remaining--
                        //delete cschem.blocks[correctdata[0]]
                    }

                    public.state = "restocking"
                }

                //doesnt need to take up memory after checking, only relevant on first take of the schem
                delete cschem.needschecking
                public.info.currentbuild = cschem
                public.decidetowipe = false
                console.log(public.info.currentbuild.palette)
            }

            //this would get setup as the bot went to wipe the previous map lmao
            if (public.listenergrid == undefined && (public.state == "building" || public.state == "restocking")) {
                console.log("force new grid")
                genlistenergrid()
            }

            //state for building action
            if (public.state == "building") {
                console.log(public.state)

                //actually build the map art :catflushed:
                while (seedcheck() === true) {
                    console.log("building " + Skainet.mods.Internals.ctime(true))
                    var cblock = undefined

                    //find area closest to the bot that needs to be built
                    var cpos = (public.info.atcarpetduper == true ? bot.findBlock({ matching: bot.registry.blocksByName.iron_block.id, maxDistance: 16 })?.position : public.info.lastbuildcarpet) ?? Skainet.mods.Internals.fixpos(bot.entity) //fixpos gets the block the bot position is currently occupying
                    cpos.y = public.info.startpos.y //just to be safe, safegoto will fail after a minute in the case the bot isnt in the area anyways
                    cblock = getnearestmissing(cpos)
                    public.info.atcarpetduper = false

                    //this works 99.5% of the time, however it should be recognized that due to cases of extremely high ping or server instability the
                    //getnearestmissing function can fail due to chunks not loading etc and it exhausts the small area it has loaded client sided
                    //considering the cases where it happens are few and far between, as well as easy to manually restart that map etc i wont be
                    //implementing a fix and will just be trusting it, but KEEP THIS SHIT IN MIND
                    if (cblock == undefined) {
                        console.log("mapart is detected to be completed") //YOU HAVE A REMOTE ORDER
                        public.state = "mapping"
                        delete public.info.lastbuildcarpet
                        public.info.usecostsystem = false
                        public.info.costs = {}
                        break
                    }

                    //console.log("after got cblock")

                    //go to the missing block
                    var walkto = undefined

                    //figure out best carpet spot and best air spot
                    var bestcorrect = undefined
                    var bestincorrect = undefined

                    for (let i = 0; i < cardinals.length; i++) {
                        var newcoords = cblock.offset(cardinals[i].x, cardinals[i].y, cardinals[i].z)
                        var iswalkable = bot.blockAt(newcoords)

                        if (iswalkable == null) { continue } //out of render distance

                        var walkablestr = newcoords.toString()

                        if (typeof public.info.currentbuild.inbounds[walkablestr] != "boolean") { continue } //out of bounds of schem

                        var dist = bot.entity.position.distanceTo(newcoords)

                        //we prefer to stand on the closest correct to schem block off of the neighbour, however in some cases we may have to default
                        //to an incorrect block, in which case we still prefer the closest to the account
                        if (iswalkable.type === public.info.schem.palette[public.info.currentbuild.blocks[walkablestr]] && (bestcorrect == undefined || dist < bestcorrect[1])) {
                            bestcorrect = [newcoords, dist]
                        } else if (bestincorrect == undefined || dist < bestincorrect[1]) {
                            bestincorrect = [newcoords, dist]
                        }
                    }

                    walkto = bestcorrect ?? bestincorrect // ?? pull it out of my ass

                    //no walkable neighbouring surfaces, this should normally be impossible
                    if (walkto == undefined) {
                        Skainet.mods.Actions.actionfail("Current block doesnt have any walkable neighbours")
                        return
                    }

                    walkto = walkto[0] //vec3 coords

                    //console.log("pathing carpet neighbour")
                    await safegoto(walkto)
                    if (!seedcheck()) { return }

                    public.info.lastbuildcarpet = cblock
                    //all of this dogshit above gets us to a block we havent placed and then a valid surface beside it that we can place the carpet from

                    var blockstofillin = getmissingneighbours(walkto)

                    //this should NEVER happen but bot.dig is fucked
                    if (blockstofillin.length == 0) {
                        if (public.info.desyncfails >= 3) {
                            public.info.desyncfails = 0
                            Skainet.mods.Actions.actionfail("No blocks to fill in off of neighbours, schem desync?", true, true)
                            return
                        }

                        public.info.desyncfails++
                        console.log("desync fail hit, grace delay before next run") //using bot.dig causes this 99% of the time

                        await Skainet.mods.Internals.wait(3)
                        await Skainet.mods.Internals.oncetimeout(bot._client, "packet", 33000, 1) //make sure server isnt retarded
                        if (!seedcheck()) { return }

                        continue //force rerun
                    } else {
                        public.info.desyncfails = 0
                    }

                    //this sorts all the neighbours carpet in a way that we place each type of carpet fully before moving onto the next
                    //to reduce the amount of delay by swapping
                    blockstofillin.sort(function (a, b) { return public.info.schem.palette[public.info.currentbuild.blocks[a.toString()]] - public.info.schem.palette[public.info.currentbuild.blocks[b.toString()]] })

                    var usedcolours = public.info.usecostsystem ? {} : undefined
                    var currentcounter = bot.heldItem?.count ?? 0

                    while (blockstofillin.length > 0) {
                        if (!seedcheck()) { return }
                        var cblockloop = blockstofillin[0]
                        //console.log(cblockloop.toString())
                        var cblockdata = bot.blockAt(cblockloop)

                        //this issue comes up for a handful of reasons, it needs to be here for the cases it happens even though i dont like it
                        //whether 2b crash, ping issue, etc it still happens
                        if (cblockdata == null) {
                            Skainet.mods.Actions.actionfail("Current block returned null during blockstofillin", true)
                            return
                        }

                        var needstobe = public.info.schem.palette[public.info.currentbuild.blocks[cblockdata.position.toString()]]
                        var lookingat = false
                        //console.log(needstobe)

                        //we need to break the block currently at the coordinates in order to place the new carpet
                        if (cblockdata.type !== bot.registry.blocksByName.air.id) {
                            await bot.lookAt(cblockdata.position.offset(0.5, 0, 0.5), true) //because of "ignore" setting
                            lookingat = true
                            await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 1000, 1)
                            if (!seedcheck()) { return }
                            //this fucking function known as bot.dig has caused so many issues, especially during high ping
                            await bot.dig(cblockdata, "ignore", "auto")
                            await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 1000, 4) //down this delay time after custom dig too
                            if (!seedcheck()) { return }
                        }

                        var placingoffof = bot.blockAt(cblockdata.position.offset(0, -1, 0))

                        if (!lookingat) {
                            //place off of sea lantern below
                            await bot.lookAt(cblockdata.position.offset(0.5, -0.5, 0.5), true)
                        }

                        var carpetname = bot.registry.blocks[needstobe].name
                        var itemid = bot.registry.itemsByName[carpetname].id
                        var hascarpet = true

                        if (bot.heldItem?.type != itemid) { //force this if were failing as we may be desynced?
                            hascarpet = await fastequip(carpetname)
                            await Skainet.mods.Internals.oncetimeout(bot._client, "packet", 33000, 1) //make sure server isnt retarded
                            if (!seedcheck()) { return }

                            if (hascarpet === true) {
                                currentcounter = bot.heldItem?.count ?? 0 //fallback to 0 so next code down does correcting
                            }
                        }

                        if (usedcolours != undefined) {
                            usedcolours[carpetname] = true
                            public.info.costs[carpetname] = 0
                        }

                        //at this point we actually need to grab more carpet
                        //this might not be as efficient because we could be using a lot of 1 specific colour etc, but thats besides the point
                        if (hascarpet != true) {
                            console.log("carpet not in inventory or failed to equip, restocking")
                            public.state = "restocking"
                            break
                        }

                        var packet = {
                            location: placingoffof.position,
                            direction: 1,
                            hand: 0,
                            //was lazy but u can raycast for more random cursor pos, 2b2t doesnt care
                            cursorX: 0.5,
                            cursorY: 1,
                            cursorZ: 0.5,
                            insideBlock: false,
                            sequence: public.sequence
                        }

                        //dispensers are in the floor as part of the machine
                        if (placingoffof?.type === bot.registry.blocksByName.dispenser.id) {
                            //console.log("need to sneak")
                            bot.setControlState("sneak", true)
                        }

                        await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 1000, 1)
                        if (!seedcheck()) { return }
                        //await bot.placeBlock(bot.blockAt(cblockdata.position.offset(0, -1, 0)), new Vec3(0, 1, 0))

                        bot.swingArm("right", true)
                        bot._client.write("block_place", packet)
                        public.sequence++ //not true to vanilla behaviour as there are other packets that touch this, however 2b2t doesnt seem to give a fuck
                        bot.setControlState("sneak", false)

                        //next carpet
                        currentcounter--
                        //console.log("carpet confirmed | " + public.info.currentbuild.remaining + " / 16384")
                        blockstofillin.shift()

                        //noglitchblocks for stability
                        if (currentcounter <= 0 || blockstofillin.length == 0 || public.info.currentbuild.remaining <= 50) { //less than 50 to try and ensure final image is complete, we dont create ghost blocks on the client so keep gambling
                            await Skainet.mods.Internals.oncetimeout(bot.world, "blockUpdate:" + cblockdata.position.toString(), 5000, 1) //we only give this 5 seconds since the next await down checks for any incoming packets up to keepalive
                        }

                        //this 6 tick delay pause is needed if were running out of items
                        //currentcounter is basically a counter kept client sided and we do need to check the actual held item count
                        //to ensure its at least somewhat accurate
                        if (currentcounter <= 0 && blockstofillin.length != 0) {
                            var sanity = bot.heldItem?.count ?? 0

                            //under 7 we'll assume its ok to do this pause, ive only ever seen it be 3 or so ahead but ping dependant
                            if (sanity <= 7) { //ive got none left
                                if (currentcounter == 0) {
                                    await Skainet.mods.Internals.oncetimeout(bot, "physicsTick", 1000, 6)
                                }

                                if (!seedcheck()) { return }
                            } else {
                                console.log("reset currentcounter instead of pause | " + sanity)
                                currentcounter = sanity //incase carpet was picked up, etc
                            }
                        }
                    }

                    if (!seedcheck()) { return }

                    if (usedcolours != undefined) {
                        //console.log("cost system adjustment")
                        var usedkeys = Object.keys(public.info.costs)

                        for (let i = 0; i < usedkeys.length; i++) {
                            if (typeof usedcolours[usedkeys[i]] != "boolean") {
                                public.info.costs[usedkeys[i]]++
                            }
                        }

                        //console.log(public.info.costs)
                    }

                    bot.setControlState("sneak", false)

                    //possible we need to restock by here
                    if (public.state != "building") { break }
                }
            }

            //process for taking a map of the completed map
            if (public.state == "mapping") {
                console.log(public.state)
                public.gridcleanup()

                var stationat = public.info.carpets[1].position.offset(0, 1, 0) //south duper is the only one with the tools to map and deposit completed maps

                await safegoto(stationat.offset(0, 0, -10)) //this is done before pathing to stationat directly incase of weird angles
                if (!seedcheck()) { return }
                await safegoto(stationat)
                await Skainet.mods.Internals.wait(3)
                if (!seedcheck()) { return }

                //ugly copypasted code from restocking lol
                var glowstones = bot.findBlocks({
                    matching: bot.registry.blocksByName.glowstone.id,
                    maxDistance: 32,
                    count: 17
                })

                if (glowstones.length != 17) {
                    Skainet.mods.Actions.actionfail("Carpet duper 1 didnt have 17 indicator glowstone blocks during mapping")
                    return
                }

                //determine if we need to dump our inventory
                if (!Skainet.mods.Mineflayer.inventoryempty()) {
                    //same deal as restocking, dogshit mineflayer functions get stuck in infinite awaits
                    public.restocktimeout = setTimeout(public.restockcheck, 30000)

                    console.log("dump inventory")
                    //we decide to dump the entire inventory because carpet is infinite and has 0 value or reason to save
                    var dumpdub = await finddubfromglowstone(glowstones, bot.registry.blocksByName.air.id)
                    if (typeof dumpdub != "object") { return }

                    //deposit entire inventory in the dub (this dub burns all of it)
                    for (let i = 54; i < dumpdub.slots.length; i++) {
                        if (!seedcheck()) {
                            dumpdub.close()
                            return
                        }

                        if (dumpdub.slots[i] != undefined) {
                            try {
                                await bot.clickWindow(i, 0, 1)
                                await Skainet.mods.Internals.wait(0.05)
                            } catch (error) {
                                console.log(error.message)
                            }
                        }
                    }

                    dumpdub.close()
                    if (!seedcheck()) { return }

                    clearTimeout(public.restocktimeout) //clean up previous timeout
                    delete public.restocktimeout
                }

                await safegoto(stationat)
                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }

                var gotoblock = bot.findBlock({
                    matching: bot.registry.blocksByName.oak_button.id,
                    maxDistance: Skainet.maxreach
                })

                if (!gotoblock) {
                    Skainet.mods.Actions.actionfail("No oak button at south duper for map materials")
                    return
                }

                await bot.lookAt(gotoblock.position.offset(0.5, 0.05, 0.5))
                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }
                await bot.activateBlock(gotoblock) //this does up surface by default
                await Skainet.mods.Internals.oncetimeout(bot._client, "set_slot", 33000, 2) //the redstone has a delay between items so this packet should be more stable to listen to than playerCollect event
                await Skainet.mods.Internals.wait(3)
                if (!seedcheck()) { return }

                //sanity checks
                var hasmap = await Skainet.mods.Actions.equipitem("map")
                if (!seedcheck()) { return }

                //potentially dispensers have ran out of maps
                if (!hasmap) {
                    Skainet.mods.Actions.actionfail("No map in inventory even after waiting")
                    return
                }

                //safety checking, theres another state reset further ahead for this just incase
                if (!Skainet.mods.Mineflayer.finditemininventory(undefined, "glass_pane")) {
                    Skainet.mods.Actions.actionfail("No pane in inventory even after waiting")
                    return
                }

                //the bot moves clientsided and theres really no way to know where it is until the server responds
                //so were playing it mega stupid safe with this
                while (seedcheck() === true && bot.entity.position.distanceTo(public.info.center) >= 10) {
                    await Skainet.mods.Internals.wait(1)
                    if (!seedcheck()) { return }
                    await safegoto(public.info.center) //need to go to the center to map first
                    if (!seedcheck()) { return }
                    await Skainet.mods.Internals.wait(31) //major delay because this is important, moreso for keepalive packet timeout gambling
                    await Skainet.mods.Internals.oncetimeout(bot, "time", 10000, 1) //make sure server isnt retarded
                }

                if (!seedcheck()) { return }
                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }

                console.log("activating")
                bot.swingArm("right", true) //whoever coded activateItem needs a stern talking to
                bot.activateItem()

                await Skainet.mods.Internals.oncetimeout(bot._client, "set_slot", 33000, 1)
                await Skainet.mods.Internals.wait(0.25)
                if (!seedcheck()) { return }
                console.log("set_slot packet")

                var hasmap2 = await Skainet.mods.Actions.equipitem("filled_map")
                if (!seedcheck()) { return }

                if (!hasmap2) { //lol wtf
                    Skainet.mods.Actions.actionfail("No filled map in inventory after activation", true)
                    return
                }

                await Skainet.mods.Internals.wait(5) //trust the image to load a bit initially

                //theres like 5 different ways you could do this but this was the most convenient lol
                await safegoto(public.info.center.offset(25, 0, -25))
                await Skainet.mods.Internals.wait(3)
                await Skainet.mods.Internals.oncetimeout(bot, "time", 10000, 1) //make sure server isnt retarded
                if (!seedcheck()) { return }
                await safegoto(public.info.center.offset(-25, 0, -25))
                await Skainet.mods.Internals.wait(3)
                await Skainet.mods.Internals.oncetimeout(bot, "time", 10000, 1) //make sure server isnt retarded
                if (!seedcheck()) { return }
                await safegoto(public.info.center.offset(-25, 0, 25))
                await Skainet.mods.Internals.wait(3)
                await Skainet.mods.Internals.oncetimeout(bot, "time", 10000, 1) //make sure server isnt retarded
                if (!seedcheck()) { return }
                await safegoto(public.info.center.offset(25, 0, 25))
                await Skainet.mods.Internals.wait(3)
                await Skainet.mods.Internals.oncetimeout(bot, "time", 10000, 1) //make sure server isnt retarded
                if (!seedcheck()) { return }

                public.state = "lockmap" //ended up putting this in its own state to save time in fail cases
            }

            //state for locking the map in a cartography table
            if (public.state == "lockmap") {
                console.log(public.state)

                //this step was moved out of mapping as a precaution due to some weird edge cases
                await safegoto(public.info.carpets[1].position.offset(0, 1, 0))
                if (!seedcheck()) { return }

                //meow :3
                var gotoblock = bot.findBlock({
                    matching: bot.registry.blocksByName.cartography_table.id,
                    maxDistance: 5
                })

                if (!gotoblock) {
                    Skainet.mods.Actions.actionfail("No cartography table near bot", true) //never stop gambling
                    return
                }

                if (!seedcheck()) { return }
                await Skainet.mods.Internals.wait(3)
                await bot.lookAt(gotoblock.position.offset(0.5, 0.5, 0.5))
                await Skainet.mods.Internals.wait(3)
                if (!seedcheck()) { return }

                //we need this for the surface
                var blockat = bot.blockAtCursor(Skainet.maxreach)

                if (!blockat) {
                    Skainet.mods.Actions.actionfail("No block at cursor", true)
                    return
                }

                //open cartography table
                var got = await bot.openBlock(gotoblock, Skainet.mods.Mineflayer.facetodirection(blockat.face))
                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }

                //put map in
                try {
                    await got.deposit(bot.registry.itemsByName.filled_map.id, undefined, 1)
                    console.log("filled map in")
                } catch (error) {
                    Skainet.mods.Actions.actionfail("Filled_map failed to deposit", true)
                    return
                }

                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }

                //put pane in
                try {
                    await got.deposit(bot.registry.itemsByName.glass_pane.id, undefined, 1)
                    console.log("glass pane in")
                } catch (error) {
                    Skainet.mods.Actions.actionfail("Glass_pane failed to deposit", true)
                    public.state = "mapping" //ive never seen it happen but this resets state to redo above step just incase it didnt get a pane
                    return
                }

                await Skainet.mods.Internals.wait(1)
                if (!seedcheck()) { return }

                console.log("ready to take locked map")

                //major safety delay
                await Skainet.mods.Internals.wait(3)
                if (!seedcheck()) { return }

                if (got.slots[2]?.type !== bot.registry.itemsByName.filled_map.id) {
                    Skainet.mods.Actions.actionfail("No locked map in cartography table output slot after set_slot packet", true)
                    return
                }

                //take out
                await bot.clickWindow(2, 0, 0)
                await Skainet.mods.Internals.oncetimeout(bot._client, "set_slot", 10000, 1)
                await Skainet.mods.Internals.wait(0.1)

                //by here we should have the locked map
                got.close()
                if (!seedcheck()) { return }
                await Skainet.mods.Internals.wait(5) //yucky

                var haslockedmap = Skainet.mods.Mineflayer.finditemininventory(undefined, "filled_map")

                if (!haslockedmap) {
                    Skainet.mods.Actions.actionfail("No locked map in inventory after entire cartography table process", true)
                    return
                }

                public.state = public.config.renamemaps === true ? "renamemap" : "putawaymap"
            }

            //state for checking if the map has a name and how to name it accordingly
            if (public.state == "renamemap") {
                console.log(public.state)

                //by here were gonna check if we need to rename the map
                var expectedpath = Skainet.madir + "\\" + Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].current + ".json"
                var mapname = undefined

                //im prone to mess this up 100% tbh
                try {
                    mapname = JSON.parse(fs.readFileSync(expectedpath))
                } catch (error) {
                    console.log(error.message)
                }

                var mapflag = mapname?.flag ?? ""
                mapname = mapname?.name //dont need the rest

                //this whole if block is pure aids
                if (fs.existsSync(expectedpath) && mapname != undefined) {
                    var gotoblock = bot.findBlock({
                        matching: bot.registry.blocksByName.shroomlight.id,
                        maxDistance: Skainet.maxreach
                    })

                    if (!gotoblock) {
                        Skainet.mods.Actions.actionfail("No shroomlight for anvil checking")
                        return
                    }

                    var anvilcheck = bot.blockAt(gotoblock.position.offset(0, 1, 0))

                    if (anvilcheck == null) {
                        //this should never be null but this case is being left here just incase
                        Skainet.mods.Actions.actionfail("Null anvil check", true)
                        return
                    }

                    //in this case theres air so a new anvil needs to be placed, we dont actually verify if an anvil is here because only
                    //the bot should be interacting with this, so its either a stated anvil or air at all times
                    if (anvilcheck.type == 0) {
                        console.log("need to replace anvil")
                        var dub = bot.blockAt(anvilcheck.position.offset(0, 0, 1))

                        if (dub == null || dub?.type != bot.registry.blocksByName.trapped_chest.id) {
                            Skainet.mods.Actions.actionfail("No trapped chest for anvil restocking")
                            return
                        }

                        //same deal as restocking, mineflayer functions get stuck in infinite awaits
                        public.restocktimeout = setTimeout(public.restockcheck, 30000)

                        //look at the chest
                        await bot.lookAt(dub.position.offset(0.5, 0.5, 0.5)) //offset to look at center of the chest block
                        await Skainet.mods.Internals.wait(0.5)
                        if (!seedcheck()) { return }

                        //we need this for the surface
                        var blockat = bot.blockAtCursor(Skainet.maxreach)

                        if (!blockat) {
                            //this can fail due to being lagged back by the server and the raycast just goes through air
                            Skainet.mods.Actions.actionfail("No block at cursor during anvil chest opening", true)
                            return
                        }

                        //get window
                        var window = await bot.openContainer(dub, Skainet.mods.Mineflayer.facetodirection(blockat.face))
                        await Skainet.mods.Internals.wait(0.5)
                        if (!seedcheck()) { return }

                        //if this fails we just let the equipitem check fail
                        try {
                            await window.withdraw(bot.registry.itemsByName.anvil.id, undefined, 1)
                        } catch (error) {
                            console.log(error.message)
                        }

                        await Skainet.mods.Internals.wait(0.5)
                        window.close()
                        if (!seedcheck()) { return }

                        clearTimeout(public.restocktimeout) //clean up previous timeout
                        delete public.restocktimeout

                        //by here we should have an anvil in our inventory thats ready to be placed
                        var hasanvil = await Skainet.mods.Actions.equipitem("anvil")
                        if (!seedcheck()) { return }

                        if (!hasanvil) {
                            //better checking later, maybe theres anvils still in the chest but our withdrawl only failed, in which case we could
                            //safely relog or restart etc
                            Skainet.mods.Actions.actionfail("No anvil in inventory for anvil replacing")
                            return
                        }

                        await Skainet.mods.Internals.wait(1)
                        if (!seedcheck()) { return }

                        //by here we have an anvil in our main hand and were ready to place a new one
                        await Skainet.mods.Mineflayer.bot.lookAt(gotoblock.position.offset(0.5, 0.5, 0.5))
                        await Skainet.mods.Internals.wait(0.25)
                        if (!seedcheck()) { return }

                        blockat = Skainet.mods.Mineflayer.bot.blockAtCursor(Skainet.maxreach)

                        if (!blockat) {
                            //this can fail due to being lagged back by the server and the raycast just goes through air
                            Skainet.mods.Actions.actionfail("No block at cursor during anvil placing", true)
                            return
                        }

                        //place new anvil
                        await Skainet.mods.Mineflayer.bot.placeBlock(gotoblock, Skainet.mods.Mineflayer.facetodirection(blockat.face))
                        await Skainet.mods.Internals.wait(3) //just incase, although placeblock places clientsided so its possible this fails anyways lol
                        if (!seedcheck()) { return }

                        //by here a new anvil should be placed and we can continue on with the rest of the process
                        anvilcheck = bot.blockAt(gotoblock.position.offset(0, 1, 0))

                        if (anvilcheck.type === 0) {
                            //:mdma:
                            Skainet.mods.Actions.actionfail("No anvil even after placing", true)
                            return
                        }
                    }

                    //if we dont have a single level we need to hit a button for redstone
                    //the redstone ensures we get 3 exp bottles thrown at us so no matter what we should get the level when we need it
                    //while loop is for safety
                    //also for some fucking reason .level and .points are swapped
                    var exptries = 0

                    while (bot.experience.points < 1 && seedcheck() === true) {
                        exptries++

                        if (exptries >= 5) {
                            Skainet.mods.Actions.actionfail("Exp loop in 5 tries, assuming no bottles left in dispenser")
                            return
                        }

                        console.log("need level")

                        var gotoblock2 = bot.findBlock({
                            matching: bot.registry.blocksByName.spruce_button.id,
                            maxDistance: Skainet.maxreach
                        })

                        if (!gotoblock2) {
                            Skainet.mods.Actions.actionfail("No spruce button at south duper for exp")
                            return
                        }

                        await bot.lookAt(gotoblock2.position.offset(0.5, 0.05, 0.5))
                        await Skainet.mods.Internals.wait(1)
                        if (!seedcheck()) { return }
                        await bot.activateBlock(gotoblock2) //this does up surface by default
                        await Skainet.mods.Internals.oncetimeout(bot, "experience", 33000, 3)
                        await Skainet.mods.Internals.wait(0.1)
                    }

                    if (!seedcheck()) { return }

                    //here we need to figure out what were actually naming the mapart
                    //for maps that arent just a single map, we also include the chunk coordinates in the name
                    if (public.info.schem.width !== 128 && public.info.schem.length !== 128) {
                        var coordstr = public.info.chunkz + " " + public.info.chunkx

                        if (mapflag.includes("start")) {
                            mapname = coordstr + " " + mapname
                        } else {
                            mapname += (" " + coordstr)
                        }
                    }

                    console.log("`" + mapname + "`")

                    //i love mineflayer i love mineflayer i love mineflayer i love mineflayer i love mineflayer
                    public.restocktimeout = setTimeout(public.restockcheck, 33000)

                    var anvilwindow = await bot.openAnvil(anvilcheck)
                    await Skainet.mods.Internals.wait(1)
                    if (!seedcheck()) { return }

                    try {
                        //i wish i wasnt so lazy to not recode these functions
                        await anvilwindow.rename(Skainet.mods.Mineflayer.finditemininventory(undefined, "filled_map"), mapname)
                    } catch (error) {
                        console.log(error.message)
                        Skainet.mods.Actions.actionfail("Anvil rename fail, i love mineflayer", true)
                        return
                    }

                    clearTimeout(public.restocktimeout) //clean up previous timeout
                    delete public.restocktimeout

                    await Skainet.mods.Internals.wait(1)
                    if (!seedcheck()) { return }
                    anvilwindow.close()

                    console.log("done rename")
                }

                if (!seedcheck()) { return }
                public.state = "putawaymap"
            }

            //deposit the final named and locked map in a chest for my dumbass to go put it on the map wall
            if (public.state == "putawaymap") {
                console.log(public.state)

                //now we put the map in the barrel which will save it
                var gotoblock = bot.findBlock({
                    matching: bot.registry.blocksByName["barrel"].id,
                    maxDistance: 5
                })

                if (!gotoblock) {
                    Skainet.mods.Actions.actionfail("No barrel to deposit locked map")
                    return
                }

                if (!seedcheck()) { return }
                await bot.lookAt(gotoblock.position.offset(0.5, 0.5, 0.5))
                if (!seedcheck()) { return }

                var blockat = bot.blockAtCursor(Skainet.maxreach)

                //open barrel
                var barrel = await bot.openContainer(gotoblock, Skainet.mods.Mineflayer.facetodirection(blockat.face))
                await Skainet.mods.Internals.wait(0.5)
                if (!seedcheck()) { return }

                //put map in barrel
                try {
                    await barrel.deposit(bot.registry.itemsByName.filled_map.id, undefined, 1)
                    console.log("filled map in barrel :catflushed:")
                } catch (error) {
                    Skainet.mods.Actions.actionfail("Filled_map failed to deposit to barrel")
                    return
                }

                await Skainet.mods.Internals.wait(0.5)
                barrel.close()

                //by here we have completed the current schem and locked+mapped it
                //now we need to figure out if weve completed the current map or just a section of it

                //increment 1 on the x
                public.info.chunkx++
                console.log("shifting x " + public.info.chunkx)

                var datatest = outofbounds()

                //we are out of bounds on x and need to test z
                if (datatest == true) {
                    public.info.chunkx = 0
                    public.info.chunkz++ //note that this carries over
                    console.log("shifting z " + public.info.chunkz + ", reset x to 0")

                    datatest = outofbounds()

                    //both x and z increments failed so this map schem is 100% completed and we can move onto the next file if it exists
                    if (datatest == true) {
                        console.log("current map art is confirmed to be fully completed by schematic")
                        public.info.chunkz = 0
                        Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].current++ //this gets tested next round
                        public.info.selfwipe = true //this flags to try loading the next schem
                    }
                }

                Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].x = public.info.chunkx
                Skainet.mods.JsonHandler.jsons[Skainet.account + "Mapart"].z = public.info.chunkz
                Skainet.mods.JsonHandler.overwrite(Skainet.account + "Mapart")
                public.decidetowipe = true
                public.state = "forcecenter"
            }

            //process for actually wiping the board to start next map
            if (public.state == "wiping") {
                console.log(public.state)

                //figure out if theres already water on the board upon running
                var iswiping = false

                for (let i = 0; i < 128; i++) {
                    var blockat = bot.blockAt(public.info.startdispenser.offset(0, 0, i))

                    if (blockat?.type === bot.registry.blocksByName.water.id) {
                        console.log("water on board, skipping button press")
                        iswiping = true
                        break
                    }
                }

                //we only need to hit the button if theres no water across the board
                if (!iswiping) {
                    console.log("board is clear, need to hit button")

                    //buttons to wipe are at the center
                    await safegoto(public.info.dispenser) //try to center
                    if (!seedcheck()) { return }
                    await Skainet.mods.Internals.wait(3)
                    if (!seedcheck()) { return }

                    var gotoblock = bot.findBlock({
                        matching: bot.registry.blocksByName.oak_button.id,
                        maxDistance: Skainet.maxreach
                    })

                    if (!gotoblock) {
                        Skainet.mods.Actions.actionfail("No oak button for wiping platform")
                        return
                    }

                    await bot.lookAt(gotoblock.position.offset(0.5, 0.95, 0.5))
                    await Skainet.mods.Internals.wait(1)
                    if (!seedcheck()) { return }
                    await bot.activateBlock(gotoblock, new Vec3(0, -1, 0)) //buttons are above us so we hit down surface
                    if (!seedcheck()) { return }
                    console.log("waiting start dispenser water")
                    await Skainet.mods.Internals.oncetimeout(bot.world, "blockUpdate:" + public.info.startdispenser.toString(), 33000, 1)
                    if (!seedcheck()) { return }
                }

                //wait for water on board to finish
                console.log("waiting end dispenser water")
                var log = Skainet.mods.Internals.ctime()
                await Skainet.mods.Internals.oncetimeout(bot.world, "blockUpdate:" + public.info.enddispenser.toString(), 250000, 1)
                if (!seedcheck()) { return }

                //should probably actionfail here tbh but i havent seen any issues crop up
                if (Skainet.mods.Internals.secondssince(log) >= 248) {
                    console.log("block update didnt happen in a timely manor, just recalling lmao")
                    public.runtime()
                    return
                }

                console.log("platform cleared, grace delay")
                await Skainet.mods.Internals.wait(15)

                if (!seedcheck()) { return }

                //done building schems
                if (typeof public.info.cleanupwipe == "boolean") {
                    await disablelever()
                    if (!seedcheck()) { return }
                    Skainet.mods.Actions.actionfail("Done building all schematics and cleaned platform")

                    //soft reset
                    public.state = "none"
                    public.pathfailing = 0
                    delete public.info
                    return
                }

                //ive noticed the water fucks the physics this badly, this probably isnt needed but is easier than any other solution i can think of
                //the physics are fucked bad enough that jump spamming, walking, etc dont make this fucker move around
                public.state = "restocking"
                Skainet.mods.Actions.actionfail("Intentional disconnect after wiping incase of physics", true, true)
                return
            }

            //restocking from chest
            if (public.state == "restocking") {
                console.log(public.state)

                var closest = undefined

                for (let i = 0; i < public.info.carpets.length; i++) {
                    var currentstation = public.info.carpets[i]

                    if (Skainet.mods.Internals.secondssince(currentstation.locked) >= 300 && (closest == undefined || bot.entity.position.distanceTo(currentstation.position) < bot.entity.position.distanceTo(public.info.carpets[closest].position))) {
                        closest = i
                    }

                    //locked doesnt matter after the above conditions are checked so we set to false so we switch it to the one we chose
                    currentstation.locked = 0
                }

                //we should never hit undefined here
                var gotostation = public.info.carpets[closest]
                gotostation.locked = Skainet.mods.Internals.ctime() //flag station as closed for 5 minutes

                //console.log("pathing to valid carpet restocking station")
                await safegoto(gotostation.position.offset(gotostation.offset.x * 3, (gotostation.offset.y + 1), gotostation.offset.z * 3))
                await Skainet.mods.Internals.wait(0.5)
                if (!seedcheck()) { return }

                //get all chests
                var glowstones = bot.findBlocks({
                    matching: bot.registry.blocksByName.glowstone.id,
                    maxDistance: 32,
                    count: 17
                })

                //this fails every couple of moons due to getting lagged back by the server during pathfinding
                //this was corrected by making the pather listen for that packet etc
                if (glowstones.length != 17) {
                    Skainet.mods.Actions.actionfail("Carpet duper " + closest + " didnt have 17 indicator glowstone blocks")
                    return
                }

                //here we need to determine the carpets and amount we need out of the station
                //this gets the total raw amounts of each carpet left in the schem based off of the palette
                var carpettotals = {}

                for (let i = 0; i < optimizelayout.length; i++) {
                    var colour = optimizelayout[i]
                    var itemid = bot.registry.blocksByName[colour].id
                    var total = public.info.currentbuild.palette[itemid]

                    if (total != undefined && total != 0) {
                        carpettotals[colour] = Math.max(total, 1)
                    }
                }

                //figure out how many slots for each carpet colour
                var invslots = {}
                var invsort = []
                var keys = Object.keys(carpettotals)

                //figure out how many slots we should dedicate to each colour
                for (let i = 0; i < keys.length; i++) {
                    var slotcount = Math.round(36 * (carpettotals[keys[i]] / Math.max(public.info.currentbuild.remaining, 16))) //36 being inventory slots and 16384 being the blocks in the mapart

                    invslots[keys[i]] = slotcount
                    invsort.push([keys[i], slotcount])
                }

                var invkeys = Object.keys(invslots)

                //this isnt perfect due to rounding so if we have more than 36 items we subtract from the largest ones
                var totalslots = 0

                for (let i = 0; i < invkeys.length; i++) {
                    totalslots += invslots[invkeys[i]]
                }

                //everything below wouldn't be needed if i could actually do math :troll:
                if (totalslots > 36) {
                    //console.log("slots need decrementing, over 36")
                    for (let i = 0; i < invkeys.length; i++) {
                        var totalslot = invslots[invkeys[i]]

                        invsort.sort(function (a, b) { return b[1] - a[1] })
                        invslots[invsort[0][0]]--
                        totalslots--
                        //console.log("removing 1 off the top of total slots " + totalslots)

                        if (totalslots <= 36) {
                            //console.log("decremented corrected")
                            break
                        }

                        //update sort
                        for (let x = 0; x < invsort.length; x++) {
                            invsort[x][1] = invslots[invsort[x][0]]
                        }
                    }
                } else if (totalslots < 36) {
                    //console.log("slots need incrementing, under 36")
                    for (let i = 0; i < invkeys.length; i++) {
                        var totalslot = invslots[invkeys[i]]

                        invsort.sort(function (a, b) { return b[1] - a[1] })
                        invslots[invsort[0][0]]++
                        totalslots++
                        //console.log("adding 1 on the top of total slots " + totalslots)

                        if (totalslots >= 36) {
                            //console.log("incremented slots corrected")
                            break
                        }

                        //update sort
                        for (let x = 0; x < invsort.length; x++) {
                            invsort[x][1] = invslots[invsort[x][0]]
                        }
                    }
                }

                //curating the data to force colours left at 0 to be at least 1 without exceeding inventory limit, again math issue
                for (let i = 0; i < invkeys.length; i++) {
                    var totalslot = invslots[invkeys[i]]

                    if (totalslot == 0) {
                        invsort.sort(function (a, b) { return b[1] - a[1] })

                        var stealing = invsort[0]

                        invslots[stealing[0]]--
                        invslots[invkeys[i]]++

                        //update sort
                        for (let x = 0; x < invsort.length; x++) {
                            invsort[x][1] = invslots[invsort[x][0]]
                        }
                    }
                }

                //console.log("slots before dump")
                //console.log(invslots)

                invkeys = Object.keys(invslots)
                var firstsetup = public.info.usecostsystem
                public.info.usecostsystem = invkeys.length > 9 //this system isnt needed here
                firstsetup = public.info.usecostsystem != firstsetup && public.info.usecostsystem === true

                //console.log(public.info.usecostsystem ? "USING COST SYSTEM" : "NOT USING COST SYSTEM")
                //console.log(firstsetup ? "FIRST TIME SETUP COST SYSTEM" : "NO SETUP FOR COST SYSTEM")

                var totalslot = 0

                if (firstsetup === true) {
                    public.info.costs = {}
                }

                for (let i = 0; i < invkeys.length; i++) {
                    if (firstsetup === true) {
                        public.info.costs[invkeys[i]] = 0
                    }

                    totalslot += invslots[invkeys[i]]
                }

                //console.log(totalslot)

                if (totalslot > 36) {
                    Skainet.mods.Actions.actionfail("incorrect slots fix ur math")
                    return
                }

                //this is done here due to outsourced functions i dont have control over awaiting
                //i believe that can cause memory leaks just having awaited code that never fires, but honestly not sure
                public.restocktimeout = setTimeout(public.restockcheck, 60000) //restocking should not take more than a minute of our time

                await Skainet.mods.Internals.wait(0.5)
                if (!seedcheck()) { return }

                //determine if we need to dump our inventory
                if (!Skainet.mods.Mineflayer.inventoryempty()) {
                    //console.log("dump inventory")

                    var dumpdub = await finddubfromglowstone(glowstones, bot.registry.blocksByName.air.id)
                    if (typeof dumpdub != "object") { return }

                    //now that were in the chest interface and have a synced inventory, we need to figure out what were dumping
                    //since our last visit we may have extra stacks of a carpet that we dont actually want
                    for (let i = 54; i < dumpdub.slots.length; i++) {
                        if (!seedcheck()) {
                            dumpdub.close()
                            return
                        }

                        //something in the slot
                        if (dumpdub.slots[i] != undefined) {
                            var slotitem = dumpdub.slots[i]
                            var slotcount = slotitem.count
                            var slotname = slotitem.name
                            var dump = false

                            if (!slotname.endsWith("_carpet") || typeof invslots[slotname] != "number" || slotcount != slotitem.stackSize) {
                                dump = true
                            } else {
                                //as we read the inventory, we keep track of every full stack of that carpet colour we already have
                                //and decrement it from what we need, however once we hit 0 we know we have extra of that colour and need to
                                //get rid of them before restocking
                                if (invslots[slotname] <= 0) {
                                    dump = true
                                } else {
                                    invslots[slotname]--
                                }
                            }

                            if (dump === true) {
                                try {
                                    //console.log("DUMPING " + slotcount + " " + slotname)
                                    await bot.clickWindow(i, 0, 1)
                                    await Skainet.mods.Internals.wait(0.05)
                                } catch (error) {
                                    console.log(error.message)
                                }
                            } else {
                                //console.log("KEEPING " + slotcount + " " + slotname)
                            }
                        }
                    }

                    dumpdub.close()
                    if (!seedcheck()) { return }
                }

                //console.log("slots after dump")
                //console.log(invslots)

                //actually take the carpets out of the dubs using the totals
                for (let i = 0; i < optimizelayout.length; i++) {
                    var currentcarpet = optimizelayout[i]
                    var carpetorder = bot.registry.blocksByName[currentcarpet].id
                    var itemid = bot.registry.itemsByName[currentcarpet]?.id
                    var slotpercarpet = invslots[currentcarpet]

                    //carpet isnt needed
                    if (typeof slotpercarpet != "number") {
                        //console.log("carpet isnt even in the schem")
                        continue
                    }

                    if (slotpercarpet == 0) {
                        //console.log("full on that carpet, skipping")
                        continue
                    }

                    //console.log("grabbing " + slotpercarpet + " stacks of " + currentcarpet)

                    //we actually need some
                    var carpetdub = await finddubfromglowstone(glowstones, carpetorder)
                    if (typeof carpetdub != "object") { return }

                    var taken = 0

                    //grab carpet out of the dub
                    for (let x = 0; x < 54; x++) {
                        if (!seedcheck()) {
                            carpetdub.close()
                            return
                        }

                        if (taken >= slotpercarpet) { break }

                        //there are cases where it isnt 64 stacks, chests are trapped so that hoppers dont affect code during bot interaction
                        //id rather suck a fat fucking dick than handle that shit in interface interactions
                        if (carpetdub.slots[x] != undefined && carpetdub.slots[x].count === 64) {
                            try {
                                taken++
                                await bot.clickWindow(x, 0, 1)
                                await Skainet.mods.Internals.wait(0.05)
                            } catch (error) {
                                console.log(error.message)
                            }
                        }
                    }

                    carpetdub.close()
                    if (!seedcheck()) { return }
                }

                //going to a sign is just safer and faster than directly pathing incase its cutting too big of a corner
                //we also want to go to nearest sign due to the position being dynamic depending on carpets etc
                var gotoblock = bot.findBlock({
                    matching: bot.registry.blocksByName.oak_sign.id,
                    maxDistance: 16
                })

                if (!gotoblock) {
                    Skainet.mods.Actions.actionfail("No oak sign to path to")
                    return
                }

                if (!seedcheck()) { return }
                await safegoto(gotoblock.position.offset(gotostation.offset.x, gotostation.offset.y, gotostation.offset.z))
                if (!seedcheck()) { return }

                clearTimeout(public.restocktimeout) //clean up previous timeout
                delete public.restocktimeout
                public.state = "building"
                public.info.atcarpetduper = true
            }

            //recall loop for the entire thing
            if (!seedcheck()) { return }
            public.runtime()
        }

        //lets fucking go
        if (!seedcheck()) { return }
        public.runtime()
    }
}

module.exports = public
