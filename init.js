const builder = require('botbuilder')
const restify = require('restify');

module.exports = Alan => {

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

    Alan.init = function(flow) {
        Alan.flow = flow
        Alan.server = restify.createServer()
        let server = Alan.server
    
        server.listen(process.env.port || process.env.PORT || 3978, function () {
            console.log('%s listening to %s', server.name, server.url); 
        })
    
        Alan.connector = new builder.ChatConnector({
            appId: process.env.MicrosoftAppId,
            appPassword: process.env.MicrosoftAppPassword,
            openIdMetadata: process.env.BotOpenIdMetadata 
        })
        let connector = Alan.connector
        
        // Listen for messages from users 
        server.post('/api/messages', connector.listen());  
    
        Alan.storage = new builder.MemoryBotStorage();
    
        Alan.bot = new builder.UniversalBot(connector, [
            session => {
                new Alan(session).go()
            }
        ]).set('storage', Alan.storage)
    
        Alan.bot.dialog('alan.daemon', [
            async session => {
                let alan = Alan.from(session)
                let dialog = alan.dialog
   
                // Do nothing until alan.dialog.start() is called
                await new Promise((resolve, reject) => {
                    alan.dialog.start = resolve
                    if (alan.dialog.ready) {
                        alan.dialog.ready()
                        alan.dialog.ready = null
                    }
                })
                                
                builder.Prompts[dialog.type](session, ...dialog.arguments)
            },
            (session, results) => {
                let alan = Alan.from(session)
    
                alan.dialog.results = results
    
                // Restart the dialog and make a callback for alan.prompt to proceed
                session.replaceDialog('alan.daemon')
                alan.dialog.end()
            }
        ])

        for (key in Alan.commands) {
            Alan.prototype[key] = function() {
                Alan.commands[key](this)
            }
        }
    }

}