// Create chat connector for communicating with the Bot Framework Service
const crypto = require('crypto');
const alans = {}

const builder = require('botbuilder')
const restify = require('restify');

const Rx = require ('xregexp')
var rx = require ('./regexps')

function getAlan(session) {
    return Alan.from(session)
}


class Alan {      

    constructor(session) {

        this.uid = crypto.randomBytes(16).toString('hex')

        alans[this.uid] = this
        session.userData.alan = this

        Object.assign(this, Alan.default)

        Object.defineProperty(this, "session", {
            get: () => { return session }
        })

    }

    static get default() {
        return {
            vars: {},
            choice: {},
            dialog: {},
//            branches: [Alan.code.slice()],
            command: {name: "", argument: null, results: null},
            commandStack: [],
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

    static get alans() { return alans }

    // "Unfolds" a string including inline variables, etc.
    format(str, obj) {
        let alan = this

        if (!obj) {
            obj = alan.vars
        }
        let variables = str.match(rx.inlineVar)
        if (variables) {
            variables.forEach((inlineVarName) => {
                let varValue = Alan.getVar(obj, inlineVarName.slice(1))
                str = str.replace(new RegExp("\\" + inlineVarName, 'g'), varValue)
            })                
        }

        return str
    }

    static parse(item) {
        if (Array.isArray(item)) {
            return {name: "choose_", argument: '_choice'}
        } else if (typeof item == "number") {
            return {name: "goto", argument: item.toString()}
        } else if (typeof item == "string") {
            if (item[0] == "#") {
                return {name: "next", argument: null}
            } else if (item.substring(0,2) == ">>") {
                return {name: "goto", argument: item.substring(2)}
            } else {
                let match = item.match(rx.command)
                if (match) {
                    return {name: match[1], argument: match[2]}
                } else {
                    return {name: "print", argument: item}
                } 
            }
        }
    }

    static getVar(obj, varName) {
        let location = Alan.getVarLocation(obj, varName)
        return location.branch[location.leaf]
    }

    static getVarLocation(obj, varName) {
        let children = varName.split('.')
        let varBranch = obj
        while (children.length > 1) {
            let item = children.shift()
            if (!(item in varBranch)) {
                varBranch[item] = {}
            }
            varBranch = varBranch[item]                
        }
        return {branch:varBranch, leaf:children}
    }

    static from(session) {
        return alans[session.userData.alan.uid]
    }

    currentBranch() {
        let alan = this
        let branch = alan.branches[0]

        if (branch.length == 0) {
            alan.branches.shift()
            if (alan.branches.length == 0) {
                alan.branches = [Alan.code.slice()]
            }
        }

        return branch
    }

    push(what) {
        let stack = this.commandStack
        stack.push(what)
        console.log(">> " + stack.join(" >> "))
    }

    pop() {
        let stack = this.commandStack
        stack.pop()
        console.log(stack.join(" >> ") + " <<")
    }

    get lastStacked() {
        let stack = this.commandStack
        return stack[stack.length - 1]
    }


    async do(what) {
        this.push(what)
        await Alan.commands[what](this)
        this.pop()
    }

    async go() {
        let alan = this

        await new Promise((resolve, reject) => {
            alan.dialog.ready = resolve
            alan.session.beginDialog('alan.daemon')
        })

        Alan.flow(this)
    }

    purgeMessages() {
        while (this.messages.length > 0) {
            this.session.send(this.messages.shift())
        }
    }

    async prompt(dialogType, text, optionsOrChoices, options) {
        let dialog = this.dialog
        let session = this.session

        this.purgeMessages()
        // Send out any pending  messages
        await new Promise((resolve, reject) => {
            session.sendBatch(resolve)
        })

        return new Promise(async (resolve, reject) => {
            dialog.end = resolve
            dialog.type = dialogType
            dialog.arguments = [text, optionsOrChoices]

            if (dialogType == 'choice') {
                dialog.arguments.push(options)
            }

            dialog.start()
        })
    }

}

var rx = require('./regexps')

module.exports = Alan