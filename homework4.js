const fs = require("fs");
const ical = require('node-ical');
const prompt = require("prompt-sync")({sigint: true});
module.exports = { 
    testing
};

let exit = false;
let takenDates = [];
const database = "database.ics";
let holidays = [];

function main() {
    initialParse();
    createHolidays();
    readCommandPrompt();
}

// function that is used for easily testing jasmine cases
function testing(attendee, date, numberToTest, confirmationID) {
    let success = null;
    // scheduling appointment
    if (numberToTest == 1) {
        let outcome = scheduleAppointment(attendee, date);
        if (outcome == -1) {
            success = false;
        } else {
            success = true;
        }
    } else if (numberToTest == 2) { // looking up appointment
        success = lookUpAppointment(confirmationID);
    } else if (numberToTest == 3) { // cancel appointment
        let outcome = cancelAppointment(confirmationID);
        if (outcome == -1) {
            success = false;
        } else {
            success = true;
        }
    }
    return success;
}

function readCommandPrompt() {
    while (!exit) {
        console.log("1: Schedule an appointment");
        console.log("2: Lookup appointment");
        console.log("3: Cancel appointment");
        console.log("4: Exit");
        let step = prompt("Please enter one of the above numbers: ");
        if (step == "1") {
            let attendee = prompt("Please enter a phone number or an email: ");
            if (checkForPhoneEmail(attendee) != true) {
                console.log("Invalid phone number or email address!");
                continue;
            }
            let potentialDate = prompt("Please enter the first date you are available (format YYYYMMDDTHHMMSS): ");
            let eventToAdd = scheduleAppointment(attendee, potentialDate);
            if (eventToAdd != -1) {
                changeLine(database, database.length, "");
                for (i = 0; i < eventToAdd.length; i++) {
                    fs.appendFileSync(database, eventToAdd[i], function (err) {
                        if (err) throw err;
                    });
                }
                fs.appendFileSync(database, "END:VCALENDAR", function (err) {
                    if (err) throw err;
                });
            }
        } else if (step == "2") {
            let patientID = prompt("Please enter your confirmation/patient ID: ");
            lookUpAppointment(patientID);
        } else if (step == "3") {
            let code = prompt("Please enter your confirmation/patient ID: ");
            let worked = cancelAppointment(code);
            if (worked != -1) {
                console.log(`Event for attendee ${worked} was successfully cancelled.`);
            } else {
                console.log(`Event was not found.`);
            }
        } else if (step == "4") {
            console.log("Good bye!");
            break;
        } else {
            console.log("Invalid input. Try again.");
        }
    }
}

// making a list of currently taken dates
function initialParse() {
    const events = ical.sync.parseFile(database);
    for (const event of Object.values(events)) {
        if (event.start != null) {
            takenDates.push(new Date(event.start));
        }
    }
}

// making list of holidays
function createHolidays() {
    let newYears = new Date(2024, 1, 1);
    let independence = new Date(2024, 7, 4);
    let thanksgiving = new Date(2024, 11, 28);
    let christmas = new Date(2024, 12, 25);
    holidays = [newYears, independence, thanksgiving, christmas];
}

// scheduling appointment
function scheduleAppointment(attendee, potentialDate) {
    let dates = findDate(potentialDate); // list of possible dates
    let todayDate = new Date();
    let newAppointment = ["BEGIN:VEVENT\n"];
    if (dates != -1) {
        for (i = 0; i < dates.length; i++) {
            console.log(`${i+1}: ${dates[i]}`);
        }
        let number = prompt("Above are the available dates, please choose one by number: ");
        console.log(dates.length);
        if (isNaN(number) || parseFloat(number) < 1 || parseFloat(number) > dates.length || (parseFloat(number)*10)%10 != 0) {
            console.log("That is not a valid number.");
        } else {
            console.log(`Successfully scheduled appointment for ${dates[number-1]}`);
            let confirmationCode = generateRandomCode();
            console.log(`Your confirmation code is ${confirmationCode}`);
            takenDates.push(dates[number-1]);
            newAppointment.push(`ATTENDEE:${attendee}\n`);
            newAppointment.push(`UID:${confirmationCode}\n`);
            newAppointment.push(`DTSTART:${createUnparsedDate(dates[number-1])}\n`);
            newAppointment.push(`DTSTAMP:${createUnparsedDate(todayDate)}\n`);
            newAppointment.push(`METHOD:REQUEST\n`);
            newAppointment.push(`STATUS:CONFIRMED\n`);
            newAppointment.push("END:VEVENT\n");
            return newAppointment;
        }
    }
    return -1;
}

// looking up appointment with confirmation ID
function lookUpAppointment(patientID) {
    const events = ical.sync.parseFile(database);
    for (const event of Object.values(events)) {
        if (event.status == "CANCELLED" && event.uid == patientID) { // canceled event will not show
            console.log(`Event for ID: ${patientID} has been canceled, no information to show.`);
            return false;
        } else if (event.uid == patientID) {
            console.log(`Event for ID: ${patientID}`);
            return true;
        }
    }
    console.log("This event does not exist.");
    return false;
}

// canceling appointment
function cancelAppointment(code) {
    const events = ical.sync.parseFile(database);
    const eventsList = Object.values(events);
    let lineToChange = 2;
    for (i = 0; i < eventsList.length; i++) {
        const keys = Object.keys(eventsList[i]);
        if (eventsList[i].uid == code) {
            for (j = 0; j < keys.length; j++) {
                if (keys[j] == "status") {
                    break;
                }
                lineToChange += 1;
            }
            lineToChange -= 2;
            changeLine(database, lineToChange, "STATUS:CANCELLED");
            return eventsList[i].attendee;
        } else {
            for (j = 0; j < keys.length; j++) {
                lineToChange += 1;
            }
            lineToChange -= 2; // removing params and datetype
        }
    }
    return -1;
}

// code to change a line in the database file
function changeLine(file, index, newLine) {
    let fileLines = fs.readFileSync(file, "utf-8");
    const lines = fileLines.split("\n");
    if (newLine == "") {
        lines.pop();
    } else {
        lines[index] = newLine;
    }
    content = lines.join("\n");
    fs.writeFileSync(file, content, "utf-8");
}

// finding 1-4 possible dates in the future (limited to one week from the given date)
function findDate(date) {
    let checkDate = createDate(date);
    if (checkDate == -1) {
        console.log("Please input a valid date.");
        return -1;
    }
    let todayDate = new Date();
    if (checkDate.getHours() < 8 || checkDate.getHours() > 17) {
        console.log("Please input a time between 8 AM and 5 PM");
        return -1;
    } else if (checkDate.getTime() < todayDate.getTime()) {
        console.log("Please input a date after today.");
        return -1;
    } 
    let endDate = new Date(checkDate.getTime());
    let possibleDates = [];
    let sameDay = false;
    let holiday = false;
    if (checkDate == -1) {
        return -1;
    } else {
        for (i = 0; i < 7; i++) {
            sameDay = false;
            holiday = false;
            endDate.setDate(endDate.getDate() + 1);
            let tempDate = new Date(endDate.getTime());
            for (j = 0; j < takenDates.length; j++) {
                if (takenDates[j].getDate() == tempDate.getDate() && takenDates[j].getMonth() == tempDate.getMonth()
                && takenDates[j].getFullYear() == tempDate.getFullYear()) {
                    sameDay = true;
                }
            }
            for (k = 0; k < holidays.length; k++) {
                if (holidays[k].getDate() == tempDate.getDate() && holidays[k].getMonth() == tempDate.getMonth()
                && holidays[k].getFullYear() == tempDate.getFullYear()) {
                    holiday = true;
                }
            }
            if (sameDay != true && holiday != true && endDate.getDay() != 0 && 
                endDate.getDay() != 6 && possibleDates.length < 4) {
                possibleDates.push(tempDate);
            }
        }
    }
    if (possibleDates.length > 0) {
        return possibleDates;
    }
    return -1;
}

// confirmation ID generator
function generateRandomCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomID = "";
  
    for (i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomID += characters.charAt(randomIndex);
    }
    return randomID;
  }

// for adding date to database file
function createUnparsedDate(parsedDate) {
    let year = parsedDate.getFullYear();
    let month = parsedDate.getMonth()+1;
    let day = parsedDate.getDate();
    let hour = parsedDate.getHours();
    let minute = parsedDate.getMinutes();
    let second = parsedDate.getSeconds();
    let unparsedDate = "";
    let unparsedTime = "";
    let date = "";
    if (day < 10 && month < 10) {
        unparsedDate = `${year}0${month}0${day}`;
    } else if (day < 10) {
        unparsedDate = `${year}${month}0${day}`;
    } else if (month < 10) {
        unparsedDate = `${year}0${month}${day}`;
    } else {
        unparsedDate = `${year}${month}${day}`;
    }
    if (hour < 10 && minute < 10 && second < 10) {
        unparsedTime = `0${hour}0${minute}0${second}`;
    } else if (hour < 10 && minute < 10) {
        unparsedTime = `0${hour}0${minute}${second}`;
    } else if (hour < 10 && second < 10) {
        unparsedTime = `0${hour}${minute}0${second}`;
    } else if (minute < 10 && second < 10) {
        unparsedTime = `${hour}0${minute}0${second}`;
    } else {
        unparsedTime = `${hour}${minute}${second}`;
    }
    date = `${unparsedDate}T${unparsedTime}`
    return date;
}

// checking if it is a valid phone number/email
function checkForPhoneEmail(line) {
    let emailRegex = new RegExp(/^[^\s@]+@[^\s@]+.[^\s@]+$/);
        let phoneNumberRegex = new RegExp(/^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/);
        if (emailRegex.test(line) || phoneNumberRegex.test(line)) {
            return true;
        } else {
            return false;
        }
}

// Homework 1 code reused for the nth time to create date
function createDate(unparsedDate) {
    if (unparsedDate.length != 15 || unparsedDate.charAt(8) != "T") {
        // checking whether length of string is valid and the middle letter is a T
        return -1;
    } else {
        let year = unparsedDate.substring(0, 4);
        let month = unparsedDate.substring(4, 6);
        let day = unparsedDate.substring(6, 8);
        let hour = unparsedDate.substring(9, 11);
        let minute = unparsedDate.substring(11, 13);
        let second = unparsedDate.substring(13, 15);
        if (checkValidDate(year, month, day, hour, minute, second)) {
            date = new Date(year, month - 1, day, hour, minute, second);
            date.setFullYear(year); // this is because double digit years can be misinterpreted
            return date; 
        } else {
            return -1; // not a valid date
        }
    }
}

function checkValidDate(year, month, day, hour, minute, second) {
    if (year < 0 || year > 9999) {
        return false;
    }
    if (month < 1 || month > 12) {
        return false;
    }
    if (day < 1 || day > 31) {
        return false;
    }

    // only certain months can have 31 days
    if ((month == 2 || month == 4 || month == 6 || month == 9 || month == 11) && day == 31) {
        return false;
    }

    // leap year check
    if (month == 2 && day > 29) {
        return false;
    } else if (month == 2 && day == 29 && checkLeapYear(year) == false) {
        return false;
    }

    if (hour < 0 || hour > 24) {
        return false;
    }

    if (minute < 0 || minute > 59) {
        return false;
    }

    if (second < 0 || second > 59) {
        return false;
    }
    return true;
}

// Checks whether year is a leap year
function checkLeapYear(year) {
    if (year % 4 == 0){
        if (year % 100 == 0){
            if (year % 400 == 0){
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    }
    return false;
}

// run code
main();