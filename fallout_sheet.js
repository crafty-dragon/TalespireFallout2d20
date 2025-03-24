var clearStorageButton = undefined;
let trackedIds = {};

const GOVERNED_ATTRIBUTES = new Map();
GOVERNED_ATTRIBUTES["athletics"] = "strength"
GOVERNED_ATTRIBUTES["barter"] = "charisma"
GOVERNED_ATTRIBUTES["big-guns"] = "endurance"
GOVERNED_ATTRIBUTES["energy-weapons"] = "perception"
GOVERNED_ATTRIBUTES["explosives"] = "perception"
GOVERNED_ATTRIBUTES["lockpick"] = "perception"
GOVERNED_ATTRIBUTES["medicine"] = "intelligence"
GOVERNED_ATTRIBUTES["melee"] = "strength"
GOVERNED_ATTRIBUTES["perception"] = "perception"
GOVERNED_ATTRIBUTES["repair"] = "intelligence"
GOVERNED_ATTRIBUTES["science"] = "intelligence"
GOVERNED_ATTRIBUTES["small-guns"] = "agility"
GOVERNED_ATTRIBUTES["sneak"] = "agility"
GOVERNED_ATTRIBUTES["speech"] = "charisma"
GOVERNED_ATTRIBUTES["survival"] = "endurance"
GOVERNED_ATTRIBUTES["throwing"] = "agility"
GOVERNED_ATTRIBUTES["unarmed"] = "strength"

const DAMAGE_DICE = [1, 2, 0, 0, 'S', 'S'];

function initSheet() {
    let inputs = document.querySelectorAll("input,button,textarea");
    for (let input of inputs) {
        if (input.id != undefined && input.id != "clear-storage") {
            input.addEventListener("change", function() {
                onInputChange(input)
            });

            let titleSibling = findFirstSiblingWithClass(input, "field-title");
            if (titleSibling != null) {
                titleSibling.id = `${input.id}-field-title`;
            }
            let descSibling = findFirstSiblingWithClass(input, "field-desc");
            if (descSibling != null) {
                descSibling.id = `${input.id}-field-desc`;
            }

            let finalInput = input; //otherwise the input can change which breaks the onchange handler
            if (titleSibling == null && input.dataset.modifier != undefined) {
                //manual fix for melee/ranged attack buttons being formatted differently
                titleSibling = finalInput;
                finalInput = document.getElementById(finalInput.dataset.modifier);
            }

            if (titleSibling != null && titleSibling.dataset.diceType != undefined) {
                titleSibling.classList.add("interactible-title");
                titleSibling.style.cursor = "pointer";
                titleSibling.addEventListener("click", function() {
                    TS.dice.putDiceInTray([createDiceRoll(titleSibling, finalInput)]);
                    //we are not checking for success or failure here, but could easily by adding a .then (success) and .catch (failure)
                });
                input.setAttribute("aria-labelledby", titleSibling.id);
                if (descSibling != null) {
                    input.setAttribute("aria-describedby", descSibling.id);
                }
            } else if (titleSibling != null) {
                titleSibling.setAttribute("for", input.id);
                if (descSibling != null) {
                    input.setAttribute("aria-describedby", descSibling.id);
                }
            }
        }
    }
}

function onInputChange(input) {
    //handles input changes to store them in local storage

    let data;
    // get already stored data
    TS.localStorage.campaign.getBlob().then((storedData) => {
        //parse stored blob as json, but also handle if it's empty by
        //defaulting to an empty json document "{}" if stored data is false
        data = JSON.parse(storedData || "{}");
        if (input.type == "checkbox") {
            data[input.id] = input.checked ? "on" : "off";
        } else {
            data[input.id] = input.value;
        }
        //set new data, handle response
        TS.localStorage.campaign.setBlob(JSON.stringify(data)).then(() => {
            //if storing the data succeeded, enable the clear storage button
            clearStorageButton.classList.add("danger");
            clearStorageButton.disabled = false;
            clearStorageButton.textContent = "Clear Character Sheet";
        }).catch((setBlobResponse) => {
            TS.debug.log("Failed to store change to local storage: " + setBlobResponse.cause);
            console.error("Failed to store change to local storage:", setBlobResponse);
        });
    }).catch((getBlobResponse) => {
        TS.debug.log("Failed to load data from local storage: " + getBlobResponse.cause);
        console.error("Failed to load data from local storage:", getBlobResponse);
    });

    if (input.id == "abilities-text") {
        let actions = parseActions(input.value);
        addActions(actions);
    }
}

function findFirstSiblingWithClass(element, className) {
    let siblings = element.parentElement.children;
    for (let sibling of siblings) {
        if (sibling.classList.contains(className)) {
            return sibling;
        }
    }
    return null;
}

function parseActions(text) {
    let results = text.matchAll(/(.*) (\d{0,2}d\d{1,2}[+-]?\d*) ?(.*)/gi);
    let actions = [];
    for (let result of results) {
        let action = {
            title: result[1],
            dice: result[2],
            description: result[3]
        }
        actions.push(action);
    }
    return actions;
}

function addActions(results) {
    //remove old actions
    let oldActions = document.querySelectorAll("[id^=list-action]");
    for (let oldAction of oldActions) {
        oldAction.remove();
    }

    //add new actions
    let template = document.getElementById("abilities-template");
    let container = template.parentElement;
    for (let i = 0; i < results.length; i++) {
        let clonedAction = template.content.firstElementChild.cloneNode(true);
        clonedAction.id = "list-action" + i;
        let title = clonedAction.querySelector("[id=abilities-template-title]");
        title.removeAttribute("id");
        title.textContent = results[i]["title"];

        let description = clonedAction.querySelector("[id=abilities-template-desc]");
        description.removeAttribute("id");
        description.textContent = results[i]["description"];

        let button = clonedAction.querySelector("[id=abilities-template-button]");
        button.id = "action-button" + i;
        button.dataset.diceType = results[i]["dice"];
        button.dataset.label = results[i]["title"];
        button.addEventListener("click", function() {
            TS.dice.putDiceInTray([createDiceRoll(button, null)]);
            //we are not checking for success or failure here, but could easily by adding a .then (success) and .catch (failure)
        });

        container.insertBefore(clonedAction, document.getElementById("abilities-text").parentElement);
    }
}

function loadStoredData() {
    TS.localStorage.campaign.getBlob().then((storedData) => {
        //localstorage blobs are just unstructured text.
        //this means we can store whatever we like, but we also need to parse it to use it.
        let data = JSON.parse(storedData || "{}");
        if (Object.entries(data).length > 0) {
            clearStorageButton.classList.add("danger");
            clearStorageButton.disabled = false;
            clearStorageButton.textContent = "Clear Character Sheet";
        }
        let keyCount = 0;
        for (let [key, value] of Object.entries(data)) {
            keyCount++;
            let element = document.getElementById(key);
            element.value = value;
            if (key == "thac0") {
                element.dispatchEvent(new Event('change'));
            } else if (element.type == "checkbox" || element.type == "radio") {
                element.checked = value == "on" ? true : false;
            } else if (key == "abilities-text") {
                let results = parseActions(element.value);
                addActions(results);
            }
        }
        //adding some log information to the symbiote log
        //this doesn't have particular importance, but is here to show how it's done
        TS.debug.log(`Loaded ${keyCount} values from storage`);
    });
}

function clearSheet() {
    //clear stored data
    TS.localStorage.campaign.deleteBlob().then(() => {
        //if the delete succeeded (.then), set the UI to reflect that
        clearStorageButton.classList.remove("danger");
        clearStorageButton.disabled = true;
        clearStorageButton.textContent = "Character Sheet Empty";
    }).catch((deleteResponse) => {
        //if the delete failed (.catch), write a message to symbiote log
        TS.debug.log("Failed to delete local storage: " + deleteResponse.cause);
        console.error("Failed to delete local storage:", deleteResponse);
    });

    //clear sheet inputs
    let inputs = document.querySelectorAll("input,textarea");
    for (let input of inputs) {
        switch (input.type) {
            case "button":
                break;
            case "radio":
            case "checkbox":
                input.checked = false;
                break;
            default:
                input.value = "";
                break;
        }
    }
}

function onStateChangeEvent(msg) {
    if (msg.kind === "hasInitialized") {
        //the TS Symbiote API has initialized and we can begin the setup. think of this as "init".
        clearStorageButton = document.getElementById("clear-storage");
        loadStoredData();
        initSheet();
    }
}

async function handleRollResult(rollEvent){
    if(trackedIds[rollEvent.payload.rollId] == undefined){
        chatLog("Id: " + rollEvent.payload.rollId +" is not being tracked");
        return;
    }

    if(rollEvent.kind == "rollRemoved"){
        chatLog("Removed roll " + rollEvent.payload.rollId);
        delete trackedIds[rollEvent.payload.rollId];
        return;
    }

    chatLog(rollEvent.kind);
    let roll_type = trackedIds[rollEvent.payload.rollId];
    let roll = rollEvent.payload.resultsGroups;
    chatLog("Results " + roll.length);
    for (let index = 0; index < roll.length; index++) {
        chatLog("Result " + index + ": " + roll[index].result.results)
    }

    
    chatLog("Roll with " + roll_type);

    switch(roll_type){
        case "eyebot":
        case "mr-handy":
        case "flying-insect":
        case "quadruped":
        case "humanoid":
            hitLocationResults(roll_type, roll);
            break;
        case "damage":
            damageResults(roll);
            break;
        default:
            skillCheckResults(roll_type, roll)
    }
}

function damageResults(roll){
    chatLog("Rolling damage");
    let damage_roll = [];
    for (let index = 0; index < roll.length; index++) {
        const element = parseInt(roll[index].result.results) - 1;
        chatLog("Mapping to index " + element);
        damage_roll.push(DAMAGE_DICE[element]);
        chatLog("Recieved: " + DAMAGE_DICE[element]);
    }
    let damage_value = 0;
    let special_value = 0;
    for (let index = 0; index < damage_roll.length; index++) {
        const element = damage_roll[index];
        switch (element) {
            case 'S':
                damage_value = damage_value + 1;
                special_value = special_value + 1;
                break;
            default:
                damage_value = damage_value + parseInt(element);
                break;
        }
    }
    TS.chat.send("Rolled " + damage_value+ " damage and " + special_value + " special(s).", "campaign");
}

function hitLocationResults(character_type, roll) {
    chatLog("Hitting a: " + character_type);
    let roll_result = parseInt(roll[0].result.results);
    chatLog("Rolled a " + roll_result);

    function humanoidHits(roll_value){
        switch (roll_value) {
            case 1:
            case 2:    
                return "Head";
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
                return "Torso";
            case 9:
            case 10:
            case 11:
                return "Left Arm";
            case 12:
            case 13:
            case 14:
                return "Right Arm";
            case 15:
            case 16:
            case 17:
                return "Left Leg";
            case 18:
            case 19:
            case 20:
                return "Right Leg"
        }
    }
    function quadrupedHits(roll_value){
        switch(roll_value){
            case 1:
            case 2:
                return "Head"
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
                return "Torso"
            case 9:
            case 10:
            case 11:
                return "Left Front Leg"
            case 12:
            case 13:
            case 14:
                return "Right Front Leg"
            case 15:
            case 16:
            case 17:
                return "Left Hind Leg"
            case 18:
            case 19:
            case 20:
                return "Right Hind Leg"
        }
    }
    function flyingInsectHits(roll_value){
        switch(roll_value){
            case 1:
            case 2:
                return "Head"
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
                return "Torso"
            case 9:
            case 10:
            case 11:
                return "Left Wing (as Leg)"
            case 12:
            case 13:
            case 14:
                return "Right Wing (as Leg)"
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
                return "Legs"
        }
    }
    function mrHandyHits(roll_value){
        switch (roll_value) {
            case 1:
            case 2:    
                return "Optics (Injury as per Head)";
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
                return "Main Body (Injury as per Torso)";
            case 9:
            case 10:
            case 11:
                return "Arm 1";
            case 12:
            case 13:
            case 14:
                return "Arm 2";
            case 15:
            case 16:
            case 17:
                return "Arm 3";
            case 18:
            case 19:
            case 20:
                return "Thruster (Injury as per Leg)"
        }
    }
    function eyebotHits(roll_value){
        switch (roll_value) {
            case 1:
            case 2:    
                return "Optics (Injury as per Head)";
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
                return "Chassi (Injury as per Torso)";
            case 12:
            case 13:
            case 14:
                return "Top Mount (Injury as per Arm)";
            case 15:
            case 16:
            case 17:
                return "Base Mount (Injury as per Arm)";
            case 18:
            case 19:
            case 20:
                return "Thruster (Injury as per Leg)"
        }
    }

    let hit_location;
    let pretty_character;
    switch(character_type){
        case "eyebot":
            hit_location = eyebotHits(roll_result);
            pretty_character = "Eyebot";
            break;
        case "humanoid":
            hit_location = humanoidHits(roll_result);
            pretty_character = "Humanoid"
            break;
        case "quadruped":
            hit_location = quadrupedHits(roll_result);
            pretty_character = "Quadruped"
            break;
        case "flying-insect":
            hit_location = flyingInsectHits(roll_result);
            pretty_character = "Flying insect"
            break;
        case "mr-handy":
            hit_location = mrHandyHits(roll_result);
            pretty_character = "Mr. Handy"
            break;
    }
    chatLog("Hit the: " + hit_location);
    TS.chat.send("Hit the " + hit_location + " on the " + pretty_character, "campaign");
}

function skillCheckResults(skill, roll){
    chatLog("Checking for skill: " + skill);
    chatLog("Skill governed by: " + GOVERNED_ATTRIBUTES[skill])
    let attribute_value = parseInt(document.getElementById(GOVERNED_ATTRIBUTES[skill]).value)|| 0;
    let skill_value = parseInt(document.getElementById(skill + "-tn").value) || 0;
    let target_number = attribute_value + skill_value;
    chatLog("Target Number: " + target_number);

    let tagged = document.getElementById(skill + "-tagged").checked;
    chatLog("Skill tagged? " + tagged)

    let crit_num = tagged ? skill_value : 1;
    chatLog("Crit range: " + crit_num);

    let successes = 0;
    for (let index = 0; index < roll.length; index++) {
        const r = roll[index].result.results;
        if(r <= target_number){
            successes = successes+1;
        }
        if (r <= crit_num) {
            successes = successes + 1;
        }
    }
    chatLog("Successes: " + successes);
    TS.chat.send("Successes counted: " + successes, "campaign");
}

function chatLog(message){
    TS.debug.log(message);
}

function rollSkillCheck(skill){
    chatLog("Rolling " + skill);
    let dice_count = document.getElementById(skill + "-dice-amount").value || 0;
    chatLog("Have " + dice_count + " d20s");
    let dice_tray = [];
    for (let index = 0; index < dice_count; index++) {
        dice_tray.push({ name: skill + "-check", roll: "1d20"});     
    }

    if(dice_tray.length == 0){
        chatLog("Skipping dice tray as empty");
        return;
    }

    TS.dice.putDiceInTray(dice_tray, false).then((diceSetResponse) => {
        trackedIds[diceSetResponse] = skill;
    });
}

function rollHitLocations(type){
    chatLog("Rolling to hit " + type);
    TS.dice.putDiceInTray([{ name: type + "-hit-location", roll: "1d20"}], false).then((diceSetResponse) => {
        trackedIds[diceSetResponse] = type;
    })
}

function rollDamageDice(){
    chatLog("Rolling damage dice");
    let dice_count = parseInt(document.getElementById("damage-dice-number").value || 0);
    chatLog("Have " + dice_count + " d6's");
    let dice_tray = [];
    for (let index = 0; index < dice_count; index++) {
        dice_tray.push({ name: "damage-dice", roll: "1d6"});       
    }
    if(dice_tray.length == 0){
        chatLog("Skipping rolling empty dice tray");
        return;
    }

    TS.dice.putDiceInTray(dice_tray, true).then((diceSetResponse) => {
        trackedIds[diceSetResponse] = "damage";
    })
}