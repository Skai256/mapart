# Automated Flat Carpet Map Art Explanation

Author: Skai256

This is a quick writeup detailing how the creation of flat carpet map art was completely automated, the code behind the automation, overall statistics, and some interesting findings along the way.

### TL;DR

Flat carpet map art automation with Mineflayer, the code in its current state will take some work to get running. No, I will not help you get said code running.

# Code Explanation

All of the code for the project was written in under a week of real time spent in Visual Studio Code. [Baritone](https://github.com/cabaletta/baritone) was originally considered, however due to lack of Java knowledge and easier 24/7 upkeep [Mineflayer](https://github.com/PrismarineJS/mineflayer) was chosen for the project.

The code is really quite simple as a series of steps:

1. Recognize map art machine
2. Load and position schematic / schematic chunk
3. Build schematic
4. Map final image
5. Put locked map into output chest
6. Clear or keep previous map
7. Repeat

This won't be a full code breakdown, but rather an explanation for some of the more creative / strange solutions used in certain steps. For the full code breakdown, simply read the mapart.js file. Do note that comments in the code may not always provide accurate insight due to previous sections of it being rewritten.

### Recognize map art machine

The [machine itself](https://github.com/Skai256/mapart/blob/main/platform.png) is a large 128x128 platform with a grid of dispensers in the floor, a glass roof above it, and 3 carpet dupers of all colours around the edges powering 9 restocking stations.

Recognizing the map art machine is as simple as having the bot positioned near any diamond block in the world upon login. When the bot logs in, it references a lot of hardcoded points offset from the nearest diamond block to check if it is the machine schematic or not. This allows the machine to be built anywhere within the world and remain functional.

### Load and position schematic / schematic chunk

Positioning the schematic is as easy as finding the north west corner of the machine and offsetting the 128x128 chunk of the schematic being used to those coordinates. The file format chosen to be read is .nbt due to ease of usage from [MapartCraft](https://rebane2001.com/mapartcraft) as it is one of the easier ways of just directly converting images into map art. MapartCraft by default also intentionally adds a cobblestone line north of the map to prevent noob lines, which is hardcoded into reading the .nbt file to be removed. Internally the .nbt is broken down into a more custom format, so as far as file reading goes pretty much any schematic format could be supported as long as code is written to read it. The decision to have built in chunking instead of relying on the 1x1 split feature of MapartCraft was for ease of renaming maps automatically, as the way chosen to build the next schematic is by incrementing a number and directly referencing that number as a .nbt file in a folder for that specific account.

### Build schematic

The building functionality has some of the cooler solutions for optimization, mainly for how the bot knows where to go for the next incorrect block. The `getnearestmissing` function essentially checks blocks spiralling outwards along the entire area of the machine starting from the last missing carpet position, the rough carpet duper position, or the bots position in order to quickly find the nearest missing block. The function also stops spiralling at certain cases when the edges of the machine or the edge of loaded chunks in the world are met. A similar approach is also used in `getmissingneighbours` for finding missing blocks that are closest to the bot for placing.

Another interesting solution is actually deciding where the bot needs to walk in order to place carpet. In order to place carpet the bot cannot occupy the space where the carpet is going to be placed so it decides to walk to the closest correct cardinal neighbour block to the missing block coordinate. That way no matter what coordinate is missing, the bot will always naturally move out of the way to ensure it can place there. There are some cases where there is absolutely no carpet which can cause the bot to not place carpet there, however on the next loop of building the bot will move back onto placed carpet from the previous loop and fill in the missed spots. The actual placing of carpet was done without the use of bot.placeBlock in order to improve speed and not have client sided ghost blocks. This was done so that bot.blockAt (which tells you what block is at a specific coordinate client side if available) is a bit more true to what is actually placed on the server. There are several issues in doing this (especially with full blocks) that I wont get into and usually appear during cases of high ping, but it works 99.5% of the time.

A lot of issues came up with the actual inventory management of carpet colours. Initially the bot was coded to grab an equal amount of every carpet in the schematic, which obviously caused a lot of backtracking in having to refill a couple specific colours etc. The solution I ended up sticking with was essentially converting the ratios of all the colours in the remaining build back into inventory slot allocations for each colour. In order to know the ratio of remaining carpet at all times, a grid of block update event listeners is done for every coordinate where the map is being built. The events will increment or decrement the remaining colours and individual colour totals for the schematic depending on what the block update was. The math for slot allocation isn't perfect as some ratios get rounded off to 0, however code was added to adjust all the allocations after the math portion to ensure all 36 slots get used most of the time. As inventory allocation operates off ratios rather than counts, it can become inefficient towards the end of a map, especially if only one colour is left. For example, say that only 5 carpets remain to be placed at the time of inventory restocking, and they all happen to be the same colour; the code will allocate all 36 slots to that colour of carpet and fill the entire inventory as a result of that 100% ratio of the respective colour. Given that carpet is completely free this was left as is.

Another solution that needed a lot of work put into it was the `fastequip` function for switching colours while building. During building of `getmissingneighbours` the carpet colours are sorted by numerical block id to ensure a minimal amount of swapping. In cases where swapping is required, the `fastequip` function checks the inventory reading backwards starting at slot 44 and decrementing to slot 9, that way if the carpet colour is found on the hotbar, swapping can be done with a single packet in the same physics tick it takes to actually look at the coordinate where the carpet is being placed. In the case that the carpet isn't in the hotbar, there are several conditions being checked before putting the carpet onto the hotbar and where. The code reads through every slot on the hotbar preferring slots in order of being an empty space, a duplicate of a colour already seen in a previous slot, or if the carpet colour hasn't been used in more than 15 loops given the schematic is using > 9 colours. This tries to ensure that the hotbar has up to 9 unique and relevant colours to try and minimise pulling out of the inventory. However in some cases, this is impossible to be met and the 9th slot on the hotbar will be constantly swapped around, fortunately this doesn't happen often.

### Map final image

Mapping the final image is as simple as walking to the carpet restocking station (which has empty maps and glass panes), pressing a button to receive them, walking to the center of the map, using the map item, walking around the map and back to the station it started at.

### Put locked map into output chest

The process for locking the map was made harder than expected when I realised that by default mineflayer believes that a cartography table is actually a stonecutter, however this was an easy fix by changing 2 lines around in [prismarine-windows.](https://github.com/PrismarineJS/prismarine-windows)

Once the map is locked, a check to rename the map is performed where it checks for a json file with the same number as the current nbt file. The name of the map depends on the size of it, for any map greater than 1x1 the x and z coordinates of the 128x128 section is added onto the name. The json file can also sometimes include a flag string which indicates a hardcoded process for adding the coordinates to the start or end of the map name, etc. The files get a little hard to keep track of sometimes but it works. When it comes to actually naming the map, a check for an existing anvil is done, if it's not there a new one is placed. Experience bottles being random does add some unexpected results where the bot can get more experience than expected, so a check is done for at least one level before pressing a button to dispense three more bottles. Specifically three bottles being dispensed was chosen due to them being random and 3 is the minimum amount you need for a single level if unlucky, which is slightly faster than checking and waiting again each time.

After locking and renaming are finished the final map is placed into a barrel which leads into more output chests to be handled by humans later.

### Clear or keep previous map

Clearing the map is only done in cases where <= 75% (75.5% in the code for a simple rounded number) of the current map is an exact match to the next map being built. The percentage 75% comes from the actual real time it takes to both place and break the remaining carpet, in a case where the current map is under this threshold it is highly likely that just building the next map from scratch is faster than recycling the previous one. These percentages cannot account for the actual travel time to go between incorrect carpets, but as a general rule of thumb it is accurate the majority of the time.

Keeping the previous map was an idea that I had and wanted to implement since the beginning of the project. It significantly speeds up the building process for maps with large areas of the same colour (i.e just text on a simple background, etc). The map keeping however only compares the previous maps in a hardcoded pattern of left to right for ease of the end user putting the maps into item frames. This process could be made even more efficient by spending more time comparing unbuilt sections of the map with the current one on the board to see if any chunks could be recycled with the current. This would make the output of the maps very random and the end user is essentially left with a puzzle which is why this wasn't done. Automating having the bot put maps on a wall is also quite complicated due to eventually needing more space, materials, etc.

The actual clearing of the map is done with only dispensers and water. The dispenser grid can clear the entire map in about 60 seconds, and could be faster but was intentionally slowed down due to tps drops. Other methods of clearing were ruled out due to reliability of the machine being unloaded due to disconnects. The entire machine uses very basic redstone and no observers for this reason.

# Carpet Statistics

Statistics won't be 100% accurate (actually unusable, i'm screaming and crying) due to the accounts having placed carpet prior to the project. Mainly white carpet having the worst offset of ~20,000 or so for Skai256. There were also times during development where some maps were discarded mid progress, rebuilt, etc. Overall you could say 99% accurate. Carpets broken are also included due to the recycling mechanic where the map is not cleared but rather kept and only some spots are replaced.

Only 3 accounts were ever actually building maps even at the peak; Skai256, monkeycatluna, and Connor16892.

Statistics as of March 21st 2024. Formatting is placed / broken

### Skai256:

Black: 6,108,008 / 197,312
White: 5,896,519 / 131,759
Light Gray: 5,585,479 / 79,686
Brown: 2,917,521 / 17,274
Gray: 2,464,955 / 53,966
Orange: 2,304,563 / 16,026
Red: 1,858,644 / 15,369
Yellow: 1,513,321 / 25,271
Green: 1,388,214 / 9,895
Cyan: 1,376,318 / 14,794
Blue: 958,342 / 32,849
Pink: 843,053 / 4,087
Light Blue: 520,094 / 7,123
Purple: 393,280 / 2,510
Lime: 392,484 / 7,302
Magenta: 215,890 / 354

Total: 34,736,685 / 615,577


### monkeycatluna:

Black: 6,060,042 / 297,699
White: 5,534,088 / 242,868
Gray: 4,090,332 / 173,115
Light Gray: 3,683,528 / 92,033
Brown: 1,655,805 / 33,006
Cyan: 1,355,944 / 36,297
Red: 1,125,006 / 25,087
Orange: 952,578 / 13,338
Yellow: 875,861 / 15,770
Green: 744,416 / 7,426
Light Blue: 711,478 / 27,026
Blue: 646,705 / 39,627
Pink: 610,463 / 4,862
Lime: 252,062 / 20,350
Purple: 187,031 / 3,300
Magenta: 142,895 / 1,337

Total: 28,628,234 / 1,033,141


### Connor16892:

Gray: 5,090,097 / 182,651
Black: 5,081,431 / 293,298
Light Gray: 4,939,406 / 115,358
White: 4,491,188 / 217,809
Cyan: 2,540,272 / 32,873
Brown: 1,330,080 / 16,049
Red: 584,683 / 7,845
Orange: 501,267 / 10,672
Yellow: 433,865 / 13,746
Light Blue: 419,897 / 20,937
Blue: 413,376 / 72,007
Green: 345,981 / 2,205
Pink: 275,510 / 12,695
Purple: 88,420 / 3,209
Lime: 82,312 / 1,517
Magenta: 13,990 / 98

Total: 26,631,775 / 1,002,969


### Combined Totals:

Black: 17,249,481 / 788,309
White: 15,921,795 / 592,436
Light Gray: 14,208,413 / 287,077
Gray: 11,645,384 / 409,732
Brown: 5,903,406 / 66,329
Cyan: 5,272,534 / 83,964
Orange: 3,758,408 / 40,036
Red: 3,568,333 / 48,301
Yellow: 2,823,047 / 54,787
Green: 2,478,611 / 19,526
Blue: 2,018,423 / 144,483
Pink: 1,729,026 / 21,644
Light Blue: 1,651,469 / 55,086
Lime: 726,858 / 29,169
Purple: 668,731 / 9,019
Magenta: 372,775 / 1,789

Total: 89,996,694 / 2,651,687

# FaQ

### How do I use mapart.js?

The entire project folder is intentionally not provided for obvious reasons, essentially without programming knowledge you probably can't. The intention of releasing the code is to hopefully inspire someone else to make something cool, as well as archival purposes. Sad truth is it will likely get skidded or someone will make a runnable copy, obfuscate it, and sell it, however that doesn't bother me. Even in its current state the project is far from user friendly, and would need a lot of interface and file checking work which I didn't feel like doing.

### What were some issues that came up during development?

One of the more simple oversights was having a glass roof above the machine which still allowed fire from lightning to show up on the final image. Only two map ids had this issue and the other was discarded before adding buttons on top of the roof. Try to see if you can find the one map that still has fire visible on it in the archive. Lightning rods are also present in all 4 corners of the machine however for peace of mind the buttons were still added.

As development went on I am confident in saying that Hausemaster has implemented some sort of server side rate limiting for bandwidth usage/automation. Towards the end of the project all of the bots went from averaging 40 ping to around 300. A lot of work was done to lessen the amount of packets and moving pistons by getting the machine down to a total of 3 carpet dupers which did work for a short while before the issue came back. I don't believe this issue was targeted or a direct result of what I was doing as other changes to the ip limit were being done prior to these issues. Truth is though this can be circumvented by hosting each bot on a different ip and doesn't solve the core issue at hand.

### Why flat carpet?

It's faster than any other type of map art due to duping, easy platform clearing, some cool code tricks, and it's completely free. At the cost of the maps actually looking good, however it has made for some interesting tactics in image editing.

### What motivated you to start this project?

Due to the initial decisions Hausemaster made for the 1.19 update I ended up moving to Constantiam for a short while. There the community is a lot more focused on map art creation and trade. The thought was to automate map art creation in order to trade map arts for items, however after the rollback the idea stuck with me although nothing was done for a while. The actual decision to begin working on this project was mostly from boredom.

The release of [IceTank's printer](https://github.com/IceTank/litematica-printer) also motivated me to make the bots building a lot faster by trusting the server (never do this) to maintain higher placing speeds. The original building system waited for a server response to ensure the carpet was actually placed before moving onto the next carpet.

### When did the project "officially" start?

Code for the project began being written on December 23rd 2023 and the full base the rest of the code was updated upon was finished by December 29th 2023. The code ran mostly uninterrupted until around January 29th 2024 where the changes for faster building without awaiting each block update event was completed. Code for renaming maps was completed on February 17th 2024. From there few changes were made for improved stability up until the release of this repo.

### How fast is map art production?

On the low end a single account averages 36 map arts every 24 hours. The operation had 3 accounts, each with their own machines. This amounted to a minimum of 108 map arts every 24 hours. However, this total does not factor in bots reusing portions of previous maps in the queue, so depending on what's being built this figure can be much higher. The 36 map arts per 24 hours is also an average of 40 minutes per map, although I have also seen some maps be completed in as few as ~35 minutes without recycling, so it varies heavily depending on the images.

### How fast do the bots place carpet?

It can maintain speeds of 20 carpets placed per second, however it pauses on the very last carpet on the building loop and also doesnt place while moving around.

### What is the largest map currently made with the bot?

The current largest map is a 56x31 (1,736 ids) image of [The Chronicles of Narnia](https://narniafans.com/wp-content/uploads/2020/09/narnia-678x381.jpg). The map took around 18 real time days start to finish with all 3 accounts working on it. Do note the real image used was significantly higher resolution than the one linked. The image was a group decision and ultimately Blocker was the one who brought up the idea as well as provided the final image.

### What were other potential images for the largest map art?

Some of the ideas that were thrown around were school of athens, berserk manga panels, nether water avalysium art, james webb images, crunchy cat luna, narnia, a custom 2b2t history timeline, and vela supernova remnant.

### What was the first map art ever created with the bot?

The first map art was a 1x1 of the logo for the [Astral Brotherhood](https://astralbrotherhood.com/) due to only having 3 colours it was easy to use as a benchmark before coding proper inventory management. The map was made by only placing a singular carpet, moving, and repeating.

### What are some ideas you had to use this bot for?

Obviously making map art, however one of the funniest ideas to come out of this project was storing files as map arts and opening a 2b2t cloud storage service. This is completely possible however never came to be for very obvious reasons. A couple other ideas were making every frame of [bad apple](https://www.youtube.com/watch?v=FtutLA63Cp8), shrek, luna crunching, etc.

### What is the "Extras" folder?

This folder contains some external code that was involved in the project. `mapeditor.js` was used for splitting up larger maps across multiple bot folders. `carpettotals.js` was used for easily formatting the statistics for this document.

### Who are GAN G SEA LANTERN?

Just a group of friends having a good time.

### Where did the group name come from?

Chinpachi started the name "the sea lantern guys" which later a propaganda map showing a cursive font of the name accidentally made "guys" look like "gays" and the name was adopted for future maps. The name has also been referred to as "gang sea lantern" or "GAN G SEA LANTERN" by members.

### Who designed the propaganda map arts?

I did all of the image editing in [paint.net](https://www.getpaint.net/) and some ideas came from within the group.

### Will there be any more large map art drops?

Highly unlikely, maps will be posted as they are finished from here on out as the project slowly comes to an end.

### Will other types of map art such as full block, staircased carpet, etc be automated in the future?

Potentially, no promises, however quite unlikely. I hope that this project gets the ball rolling for others to automate their own map art creation. I also do not want to help you automate other types of map art in any way shape or form.

### How many map arts were produced with the bot?

Judging off of world downloads of the map art wall, the final id count has just surpassed 6,100 by the release of this repo. Actual count for images is unknown but likely a few hundred.

### Did any humans actually build map arts?

Nobody in the group, not even me, placed a single block of any map arts currently produced. All of the heavy lifting was done by the mapart.js bot.

### Is flat carpet map art dead?

If your only goal is to try and make the largest map then for the most part it's pretty dead. However, It's only dead if you stop making map arts. Appreciate the art and not the artist.

### What would you change if you wrote the code again?

Proper handling of infinite yielding awaits, that's the one main thing I genuinely hate about Mineflayer and makes working with it 50x more annoying as you end up having to rewrite a lot of the functions to not have this issue, or some sort of retrying. Also universally accepting .nbt, .schematic, and .litematic formats as currently the parsing is hardcoded for .nbt files.

Another big issue I have is hardcoded delays instead of listening for packets in a few places. They are easy to fix but the issues never came up so I never ended up doing anything about it.

### How were images handled behind the scenes?

There was just a queue channel in a discord server which was all manually converted into images through MapartCraft. A reaction system was used to indicate maps being in queue, finished on the server, or other issues. Early on the idea of having users upload an image directly to a discord bot came up, however this was decided against for convenience with image editing and the tools MapartCraft provides. I also didn't want everyone to go through the process of figuring out MapartCraft, specific settings, etc.

### Will a schematic for the machine be released?

Schematic has been added as of April 21st 2024. The only things of note are all the carpet stations use item filters for each carpet colour and the dispensers in the floor contain water buckets. All other chests are labelled but let me know if something isn't clear and I'll add clarification here. Footage of bots actually building will be added at a later date.

### Will this repo be upkept in the future?

Any code changes or FaQ changes will be added. Once everything has fully concluded behind the scenes a final statistics update will also be provided (original will be left in, new below), however eventually this will not be maintained any further as I'd like to move on to other projects.

### Will you help me with the code or a personal project?

If you have any interesting questions you think should be added to the FaQ, then I will answer and likely add them. However, if you reach out to me for anything related to technical support with the code, commissions, or similar you will likely be unapologetically blocked.

### Do you take commissions for programming?

No, I don't want your money.

# Credits

[Me](https://github.com/Skai256) for writing the code, designing the machine, writing this document, and general upkeep on 2b2t.
[rebane2001](https://github.com/rebane2001) for creating and hosting [MapartCraft.](https://rebane2001.com/mapartcraft)
[PrismarineJS](https://github.com/PrismarineJS) team for creating and maintaining [Mineflayer](https://github.com/PrismarineJS/mineflayer) as well as all of the relevant packages.
Joey_Coconut for helping write and review the document.
Sea lantern gang members for images, ideas, help building machines, and document review.
A massive thank you as well to everyone who kept a backup of one of the earlier mapart.js versions, I appreciate it.
