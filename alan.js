var bot

//const builder = require('botbuilder')

const Rx = require ('xregexp')
var rx = require ('./regexps')

function getAlan(session) {
    return new Alan(session)
}

function prepare(code, branch = []) {
    let labels = Alan.labels

    for (var i = 0; i < code.length; i++) {
        item = code[i]
        pos = branch.concat(i)
        if (Array.isArray(item)) {
            prepare(item, pos)
        } else if (typeof item == "string" && item[0] == "#") {
            labels[item.substring(1)] = pos
        }
    }
}

class Alan {      

    constructor(session) {

        let protoAlan
        let alan = this

        if ('alan'in session.userData) {
            protoAlan = session.userData.alan
        } else {
            protoAlan = Alan.default
        }

        for (var key in protoAlan) {
            alan[key] = protoAlan[key]
        }

        Object.defineProperty(alan, "session", {
            get: () => { return session }
        })

        session.userData.alan = alan

    }

    // "Unfolds" a string including inline variables, etc.
    formatString(str) {
        let alan = this

        let variables = str.match(rx.inlineVar)
        if (variables) {
            variables.forEach((inlineVarName) => {
                let varValue = alan.getVar(inlineVarName.slice(1))
                str = str.replace(new RegExp(inlineVarName, 'g'), varValue)
            })                
        }
        return str
    }

    parseCommand() {
        let item = this.item
        let alan = this

        if (Array.isArray(item)) {
            alan.command = {name: "choose.go", argument: Alan.default.choice.var}
        } else if (typeof item == "number") {
            alan.command = {name: "goto", argument: item.toString()}
        } else if (item[0] == "#") {
            alan.command = {name: "next", argument: null}
        } else if (item.substring(0,2) == ">>") {
            alan.command = {name: "goto", argument: item.substring(2)}
        } else {
            let match = item.match(rx.command)
            if (match) {
                alan.command = {name: match[1], argument: match[2]}
            } else {
                alan.command = {name: "print", argument: item}
            }    
        }
    }

    getVar(varName) {
        let alan = this
        let location = alan.getVarLocation(varName)
        return location.branch[location.leaf]
    }

    setVar(varName, varValue) {
        let alan = this
        let location = alan.getVarLocation(varName)
        location.branch[location.leaf] = varValue
    }

    getVarLocation(varName) {
        let alan = this
        let children = varName.split('.')
        let varBranch = alan.vars
        while (children.length > 1) {
            let item = children.shift()
            if (!(item in varBranch)) {
                varBranch[item] = {}
            }
            varBranch = varBranch[item]                
        }
        return {branch:varBranch, leaf:children}
    }

    static get default() {
        return {
            vars: {},
            choice: {},
            branches: [Alan.code.slice()],
            command: {name: "", argument: null, results: null},
            item: "",
            messages: [],
            context: "",
            choice: {
                branches: {},
                options: [],
                var: '_choice',
                operator: null,
                expectsCode: false,
                item: "",
                feed: []
            }      
        }
    }

    do(what, options = {}) {
        let command = Alan.commands[what]
        if (Alan.isAsync(what)) {
            let dialogName = 'alan.' + what
            if (options.replace) {
                this.session.replaceDialog(dialogName)
            } else {
                this.session.beginDialog(dialogName)
            }
        } else {
            command(this)
        }        
    }

    switchTo(what) {
        this.do(what, {replace: true})
    }

    static isAsync(commandName) {
        return !(typeof Alan.commands[commandName] === 'function')
    }

}

var rx = require('./regexps')

Alan.addCommands = function(commands, path) {
    for (var name in commands) {
        let item = commands[name]
        if (typeof item === 'function') {
            continue
        }
        let functionStack = item.slice()
        let numSteps = functionStack.length - 1
        let dialogName = 'alan.' + name
        let dialogStack = []
        while (functionStack.length > 0) {
            let command = functionStack.shift()
            dialogStack.push((session, args, next) => {
                let alan = getAlan(session)
                command(alan, session, args, next)
                if (session.dialogData["BotBuilder.Data.WaterfallStep"] == numSteps) {
                    session.endDialog()
                }
            })
        }
    bot.dialog(dialogName, dialogStack)
    }
}

Alan.init = function(code, initBot) {
    bot = initBot
    Alan.code = code

    Alan.labels = {}

    prepare(code)

    Alan.addCommands(Alan.commands)

    /*bot.dialog('alan.choose.go', [
        (session) => {
            let alan = getAlan(session)
            alan.choice.feed = alan.item
            alan.do('choose.step')
        },
        (session) => {
            let alan = getAlan(session)
            builder.Prompts.choice(session, alan.messages.shift(), alan.choice.branches, { listStyle: 3 })
        },
        (session, results) => {
            let alan = getAlan(session)
            let choice = alan.choice
            alan.command.result = results.entity
            alan.setVar(choice.var, results.entity)
            alan.branches.unshift(choice.branches[results.entity])
            alan.choice = Alan.default.choice                
            session.endDialog()
        }
    ])*/

}

module.exports = Alan