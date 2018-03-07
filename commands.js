const axios = require('axios')
const Rx = require ('xregexp')
const _ = require('lodash')

var rx = require('./regexps')

module.exports = (Alan) => {

    let commands = {

        api: {

            get: async function(url) {
                with (this) {
                    try {
                        let response = await axios(url, options)
                        return response.data
                    } catch(error) {
                        console.error(error)
                        return null
                    }
                }
            }

        },

        check: alan => {
            let name = alan.command.argument
            let value = alan.vars[name]
            let branch = alan.branches[0]
            let fork = branch.shift()
            let options = {}
            for (let i = 0; i < fork.length; i += 2) {
                if (fork[i] == value || fork[i] == 'else') {
                    alan.branches.unshift(fork[i + 1])
                    return
                }
            }
        },
    
        choose: async function(... feed) {
            let alan = this
            let choices = []
            let outcomes = {}

            while (feed.length > 0) {
                let item = feed.shift()

                if (!item ){
                    feed.shift()
                    continue
                }
                if (typeof item === 'string') {
                    let str = alan.format(item)

                    choices.push(str)  
                    outcomes[str] = feed.shift()
                } 
                else if (Array.isArray(item)) {
                    let array = item
                    let nextItem = feed.shift()
                    let outcome = nextItem

                    if (typeof nextItem === 'string') {
                        let choicePattern = nextItem
                        outcome = feed.shift()
                        array.forEach((element) => {
                            let choice = alan.format(choicePattern, element)
                            choices.push(choice)
                            outcomes[choice] = async () => {
                                await outcome(element)
                            }
                        })
                    } else {
                        array.forEach((choice) => {
                            choices.push(choice)
                            outcomes[choice] = outcome
                        })
                    }
                }
            }

            await alan.prompt('choice', alan.messages.pop(), choices, { listStyle: 3 })
    
            let choice = alan.dialog.results.response.entity
            let outcome = outcomes[choice]

            this.jump(outcome)
        },

        dummy: () => {},
    
        // Sends out any pending messages
        fire: function() {
            while (this.messages.length > 0) {
                this.session.send(this.messages.shift())
            }
        },

        // “Glues” a message to the batch to be sent out once fire is called
        glue: function(message, obj) {
            with (this) {
                let last = messages.length - 1
                messages[last] += '\n\n' + format(message, obj)
            }
        },

        jump: async function(label, args) {
            let where = label
            if (args) {
                where = () => {
                    label(args)
                }
            }
            process.nextTick(where)
        },
    
        load: async function() {
            let a = this

            await a.prompt('attachment', a.messages.pop)

            let results = a.dialog.results
            await new Promise((resolve, reject) => {
                Alan.bot.connector('*').getAccessToken(
                    async (err, token) => {
                        let file = results.response[0]
                        let response = await axios({
                            method: 'get',
                            url: file.contentUrl,
                            responseType: 'stream',
                            headers: {
                                'Authorization': 'Bearer ' + token,
                                'Content-Type': 'application/octet-stream'
                            }
                        })
                        file.data = response.data._readableState.buffer.head
                        a.vars[a.command.argument] = file
                        resolve()
                    }
                )
            })
        },
    
        put: function(message, obj) {
            let session = this.session
            let messages = this.messages

            this.fire()

            session.sendTyping()

            let str = this.format(message, obj)

            if (message.match(rx.loading)) {
                session.send(str)
            } else {
                messages.push(str)
            }
        },
    
        read: async function(request) {
            let alan = this

            await alan.prompt('text', request)
            return alan.dialog.results.response
        },
    
        set: function(what, toWhat) {
            let args = Rx.exec(alan.command.argument, rx.args['set'])
            let value
            //let args = argument.split(' ')
            if (args.boolean) {
                value = 1
            } else if (args.number) {
                value = Number(args.number)
            } else if (args.toNextItem) {
                value = alan.branches[0].shift()
            } else if (args.var) {
                value = alan.getVar(args.var)
            } else {
                value = args.value
            }
            alan.setVar(args.what, value)
        },
    
        next: alan => {}
    }

    Object.assign(Alan.prototype, commands)

    return Alan

}
