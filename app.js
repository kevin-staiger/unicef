var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cacheResponseDirective = require('express-cache-response-directive');
var stream = require('logrotate-stream');
var AWS = require('aws-sdk')
var _ = require('underscore');
var request = require('request');

var socketio;

var app = express();


app.use(
  "/", 
  express.static(__dirname) 
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({}));

//load config
var config = require('./config/config')

//set port
app.set('port', config.port)

// view engine setup
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));

//set access logs
try {
    fs.mkdirSync(__dirname + '/logs/');
}
catch (ex) {
    if (ex.code != 'EEXIST') {
        throw ex;
    }
}

var accessLogStream = stream({
                                 file: __dirname + '/logs/access.log',
                                 size: config.accessLog.fileSize,
                                 keep: config.accessLog.keep,
                                 compress: config.accessLog.compress
                             });

logger.format('access', '[:date] ip=:remote-addr mtd=:method url=:url http=:http-version rfr=":referrer" st=:status cl=:res[content-length] - time=:response-time ms');
app.use(logger('access', {stream: accessLogStream, buffer: true}));

//configure

app.use(cookieParser());
app.disable('etag')
app.use(cacheResponseDirective());
app.use(express.static(path.join(__dirname, 'public')));

//routes
var routes = require('./routes/index')(config);
var isactive = require('./routes/isactive');
var buildinfo = require('./routes/buildinfo');
app.use('/', routes);
app.use('/isActive', isactive);
app.use('/buildInfo', buildinfo);

var requests = {};
var lastRequestId = 0;

app.get('/create', function(req, res){
    var reqId = 'r'+(lastRequestId++);
    requests[reqId] = {
        vaccineKey: req.query.vaccineKey,
        qty: req.query.qty,
        reqId: reqId,
        outReachPhone: null,
        outReachConfirmed:false,
        requesterPhone: req.query.phone,
        requesterConfirmed: false,
        dispatched: false
    };
    broadcast();
    res.json({ msg: "SUCCESS", reqId: reqId });
});

app.get('/outreachConfirm', function(req, res){
    var request = requests[req.query.reqId];
    if(request) {
        request.outReachConfirmed = true;
        broadcast();
        res.json({ reqId: req.query.reqId, msg: "SUCCESS"});
    }else{
        res.json({ reqId: req.query.reqId, msg: "FAILURE"});
    }

});

app.get('/requesterConfirm', function(req, res){
    var request = requests[req.query.reqId];
    if(request) {
        request.requesterConfirmed = true;
        broadcast();
        res.json({ reqId: req.query.reqId, msg: "SUCCESS"});
    }else{
        res.json({ reqId: req.query.requestId, msg: "FAILURE"});
    }

});

function broadcast() {
    if (socketio) {
        console.log('Re-broadcasting request state');
        socketio.sockets.emit('requestDetail', requests);
    }
}

app.setio = function(io)
{

    console.log('called')
    socketio = io;
    socketio.sockets.on('connection', function (socket) {
        console.log('Client ' + socket.id + ' is connected');

        console.log(requests);
        socket.emit('requestDetail', requests);

        socket.on('dispatch',function(dispatchRequest) {
            console.log('Got dispatch request');
            console.dir(dispatchRequest);


            var req = requests[dispatchRequest.reqId];
            if(req) {
                req.requesterConfirmed = true;
                broadcast();
            }

            var req2 = {
                //flow_name: "contact-outreach",
                flow_uuid: "74b2b04a-ccb7-43f8-9833-fd1565c4e29a",
                contacts: ["6ec30506-42e0-4e88-9624-011d6022e261"],
                //contacts_name: "vaccine-outreach",
                extra: {
                    reqId: dispatchRequest.reqId,
                    vaccineKey: dispatchRequest.vaccineKey,
                    qty: dispatchRequest.qty,
                    outreachPhone: dispatchRequest.outreachPhone,
                    requesterPhone: dispatchRequest.requesterPhone
                }
            }

            request.post({
                headers:
                {
                    'content-type' : 'application/json',
                    'accept'      : 'application/json',
                    'Authorization': 'Token 54166e63af2e250cdfb632cf779b5d71e0d2b8b8'
                },
                url:    "https://api.rapidpro.io/api/v1/runs.json",
                body:    JSON.stringify(req2),
                rejectUnauthorized: false
            }, function(error, response, body){
                console.log(error) ;
                res.json(response);
            });
        });
    });


};

// error handlers

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


// development error handler
// will print stacktrace
if (app.get('env') === 'dev') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
