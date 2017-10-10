const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const cooki = require('cookie-parser');

const app = express();


app.use(bodyParser.urlencoded({extended:true}));
//解析cookie对象
app.use(cooki());

//express请求处理管线
//每次请求的多个回调函数构成一个请求处理管线
//管线中每一个请求都可以得到该请求的数据
function islogin(req,res,next){
	if(req.cookies.username){
		next();
	}else{
		//跳转页面  重定向页面
		res.redirect('login.html')
	}
}

app.get('/answer.html',islogin,(req,res,next)=>{
	next();
})
app.get('/ask.html',islogin,(req,res,next)=>{
	next();
})

//注册
app.post('/user/register',(req,res)=>{
	fs.exists('user',(exists)=>{
		if(exists){
			//写入
			setData();
		}else{
			fs.mkdir('user',(error)=>{
				if(error){
					res.status(200).json({
						code:0,
						msg:'用户文件创建失败'
					})
				}else{
					setData();
				}
			})
		}
	})
	function setData(){
		var file = `user/${req.body.username}.txt`;
		fs.exists(file,(exists)=>{
			if(exists){
				res.status(200).json({
					code:1,
					msg:'用户已存在'
				})
			}else{
				req.body.time = Date.now();
				req.body.ip = req.ip;
				fs.appendFile(file,JSON.stringify(req.body),(error)=>{
					if(!error){
						res.status(200).json({
							code:2,
							msg:'注册成功'
						})
					}
				})
			}
		})
	}
})

//登录
app.post('/user/login',(req,res)=>{
	//根据用户名找文件
	var filename = `user/${req.body.username}.txt`;
	fs.exists(filename,(exists)=>{
		if(exists){
			fs.readFile(filename,(error,data)=>{
				if(!error){
					var user = JSON.parse(data);
					if(user.psw == req.body.psw){
						//将用户名存入cookie
						var expries = new Date();
						expries.setMonth(expries.getMonth()+1);
						res.cookie('username',req.body.username,{expries});
						res.status(200).json({
							code:1,
							msg:'登录成功'
						})
					}else{
						res.status(200).json({
							code:2,
							msg:'密码错误'
						})
					}
				}else{
					res.status(200).json({
						code:3,
						msg:'文件读取失败'
					})
				}
			})
		}else{
			res.status(200).json({
				code:4,
				msg:'用户不存在'
			})
		}
	})
})

//提问
app.post('/user/ask',(req,res)=>{
	var content = req.body.content;
	content = content.replace(/</g,'&lt');
	content = content.replace(/>/g,'&gt');
	if(req.cookies.username){
		//将获取到的问题存入到question文件夹中
		//封装一个写入的函数
		function writerFile(){
			var filename = `question/${Date.now()}.txt`;
			req.body.username = req.cookies.username;
			req.body.time = Date.now();
			req.body.ip = req.ip;
			fs.writeFile(filename,JSON.stringify(req.body),(error)=>{
				if(error){
					res.status(200).json({
						code:2,
						msg:'提问失败'
					})
				}else{
					res.status(200).json({
						code:1,
						msg:'提问成功'
					})
				}
			})
		}
		
		fs.exists('question',(exists)=>{
			if(exists){
				writerFile()
			}else{
				fs.mkdir('question',(error)=>{
					if(!error){
						writerFile()
					}
				})
			}
		})
	}else{
		res.status(200).json({
			code:0,
			msg:'登录异常，请重新登录'
		})
	}
})

//退出登录
app.get('/user/out',(req,res)=>{
	res.clearCookie('username');
	res.status(200).json({
		code:1,
		msg:'退出成功'
	})
})

//上传图片
//配置信息
var photo = multer.diskStorage({
	destination:'wwwroot/userPic',
	filename:function(req,file,callback){
		var fileName = file.originalname.split('.');
		callback(null,req.cookies.username+'.'+fileName[fileName.length-1]);
	}
})
//创建multer对象
var upload = multer({storage:photo});

app.post('/user/upload',upload.single('file'),(req,res)=>{
	res.status(200).json({
		code:'success',
		message:'图片上传成功'
	})
})


//首页
app.get('/user/all',(req,res)=>{
	fs.readdir('question',(error,files)=>{
		if(!error){
			//反序
			files = files.reverse();
			//创建一个数组，将每个读取到的文件内容转为一个对象存到数组中
			//readFile 异步的读取文件，不会影响for循环，for循环完了，文件还没有读取完，导致数组没有数据
			//readFileSync 同步读取 没有回调函数
			var questions = [];
			//第一种
//			for (var i=0;i<files.length;i++) {
//				var fileurl = `./question/${file[i]}`;
//				var data = fs.readFileSync(fileurl);
//				var obj = JSON.parse(data);
//				questions.push(obj);
//			}
//			console.log(questions)
			
			//第二种
//			file.forEach(function(item){
//				var fileurl = `./question/${item}`;
//				fs.readFile(fileurl,(error,data)=>{
//					var info = JSON.parse(data);
//					questions.push(info);
//				})
//			})
//			res.status(200).json(questions);
			
			//第三种
			var i = 0;
			function readFiles(){
				if(i<files.length){
					var file = files[i];
					var fileurl = `./question/${file}`;
					fs.readFile(fileurl,(error,data)=>{
						if(!error){
							var obj = JSON.parse(data);
							questions.push(obj);
							i++;
							readFiles();
						}
					})
				}else{
					//文件读取完毕
					res.status(200).json(questions);
				}
			}
			readFiles();
		}
	})
})

//回答
app.post('/user/answer',(req,res)=>{
	//将xss攻击阻止
	var content = req.body.content;
	content = content.replace(/</g,'&lt');
	content = content.replace(/>/g,'&gt');
	//取出question
	var question = req.cookies.question;
	//找到要回复的是哪个问题
	var filename = 'question/'+question+'.txt';
	//读取内容
	fs.readFile(filename,(error,data)=>{
		if(!error){
			var obj = JSON.parse(data);
			if(!obj.answer){
				obj.answer=[];
			}
			//存入内容
			req.body.ip = req.ip;
			req.body.time = Date.now();
			req.body.username = req.cookies.username;
			obj.answer.push(req.body);
//			console.log(obj)
		}
		//重新写入
		fs.writeFile(filename,JSON.stringify(obj),(error)=>{
			if(!error){
				res.status(200).json({
					code:'1',
					msg:'回答成功'
				})
			}else{
				res.status(200).json({
					code:'2',
					msg:'回答失败'
				})
			}
		})
	})
	
})

app.get('/user/pic',(req,res)=>{
	var picurl = 'wwwroot/userPic/'+req.query.name+'.jpg';
	fs.exists(picurl,(exists)=>{
		if(!exists){
			res.status(200).json({
				code:0,
				msg:'图片不存在'
			})
		}else{
			res.status(200).json({
				code:1,
				msg:'图片存在'
			})
		}
	})
})


//app.get('/user/index',(req,res)=>{
//	fs.exists('question',(exists)=>{
//		if(exists){
//			fs.readdir('question',(error,files)=>{
////				console.log(files);
//				if(error){
//					res.status(200).json({
//						code:0,
//						msg:'文件夹为空'
//					})
//				}else{
//					res.status(200).json({
//						code:1,
//						msg:files
//					})
//				}
//			})
//		}
//		
//	})
//})
//
//app.get('/user/info',(req,res)=>{
//	console.log(req.query)
//	var filename = req.query.name
//	var fileurl = `./question/${filename}.txt`
//	fs.readFile(fileurl,(error,data)=>{
//		if(!error){
//			var info = JSON.parse(data.toString());
//			res.status(200).json({
//				code:'success',
//				msg:info
//			})
//		}
//	})
//})

app.use(express.static('wwwroot'));
app.listen(3000,()=>{
	console.log('服务器开启')
})
