let User = syzoj.model('user');
let Problem = syzoj.model('problem');
let File = syzoj.model('file');
const Email = require('../libs/email');
const jwt = require('jsonwebtoken');

function setLoginCookie(username, password, res) {
  res.cookie('login', JSON.stringify([username, password]), { maxAge: 10 * 365 * 24 * 60 * 60 * 1000 });
}

// Login
app.post('/api/login', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    let user = await User.fromName(req.body.username);

    if (!user) throw 1001;
    else if (user.password == null || user.password === '') res.send({ error_code: 1003 });
    else if (user.password !== req.body.password) res.send({ error_code: 1002 });
    else {
      req.session.user_id = user.id;
      setLoginCookie(user.username, user.password, res);
      res.send({ error_code: 1 });
    }
  } catch (e) {
    syzoj.log(e);
    res.send({ error_code: e });
  }
});

app.post('/api/forget', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    let user = await User.fromEmail(req.body.email);
    if (!user) throw 1001;
    let sendObj = {
      userId: user.id,
    };

    const token = jwt.sign(sendObj, syzoj.config.email_jwt_secret, {
      subject: 'forget',
      expiresIn: '12h'
    });

    const vurl = syzoj.utils.getCurrentLocation(req, true) + syzoj.utils.makeUrl(['api', 'forget_confirm'], { token: token });
    try {
      await Email.send(user.email,
        `Email đặt lại mật khẩu ${user.username} của ${syzoj.config.title}`,
        `<p>Vui lòng nhấp vào liên kết này để đặt lại mật khẩu của bạn：</p><p><a href="${vurl}">${vurl}</a></p><p>Liên kết có giá trị trong 12h. Nếu ${user.username} không phải bạn，hãy bỏ qua email này.</p>`
      );
    } catch (e) {
      return res.send({
        error_code: 2010,
        message: require('util').inspect(e)
      });
      return null;
    }

    res.send({ error_code: 1 });
  } catch (e) {
    syzoj.log(e);
    res.send(JSON.stringify({ error_code: e }));
  }
});

// Sign up
app.post('/api/sign_up', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    let user = await User.fromName(req.body.username);
    if (user) throw 2008;
    user = await User.findOne({ where: { email: req.body.email } });
    if (user) throw 2009;


    // Because the salt is "syzoj2_xxx" and the "syzoj2_xxx" 's md5 is"59cb..."
    // the empty password 's md5 will equal "59cb.."
    let syzoj2_xxx_md5 = '59cb65ba6f9ad18de0dcd12d5ae11bd2';
    if (req.body.password === syzoj2_xxx_md5) throw 2007;
    if (!(req.body.email = req.body.email.trim())) throw 2006;
    if (!syzoj.utils.isValidUsername(req.body.username)) throw 2002;

    if (syzoj.config.register_mail) {
      let sendObj = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
      };

      const token = jwt.sign(sendObj, syzoj.config.email_jwt_secret, {
        subject: 'register',
        expiresIn: '2d'
      });

      const vurl = syzoj.utils.getCurrentLocation(req, true) + syzoj.utils.makeUrl(['api', 'sign_up_confirm'], { token: token });
      try {
        await Email.send(req.body.email,
          `Email xác minh đăng ký ${req.body.username} của ${syzoj.config.title}`,
          `<p>Hãy nhấp vào liên kết để hoàn tất đăng ký của bạn trong ${syzoj.config.title}：</p><p><a href="${vurl}">${vurl}</a></p><p>Nếu ${req.body.username} không phải bạn，hãy bỏ qua email này.</p>`
        );
      } catch (e) {
        return res.send({
          error_code: 2010,
          message: require('util').inspect(e)
        });
      }

      res.send(JSON.stringify({ error_code: 2 }));
    } else {
      user = await User.create({
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        is_show: syzoj.config.default.user.show,
        rating: syzoj.config.default.user.rating,
        register_time: parseInt((new Date()).getTime() / 1000)
      });
      await user.save();

      req.session.user_id = user.id;
      setLoginCookie(user.username, user.password, res);

      res.send(JSON.stringify({ error_code: 1 }));
    }
  } catch (e) {
    syzoj.log(e);
    res.send(JSON.stringify({ error_code: e }));
  }
});

app.get('/api/forget_confirm', async (req, res) => {
  try {
    try {
      jwt.verify(req.query.token, syzoj.config.email_jwt_secret, { subject: 'forget' });
    } catch (e) {
      throw new ErrorMessage("Token không đúng.");
    }
    res.render('forget_confirm', {
      token: req.query.token
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/api/reset_password', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    let obj;
    try {
      obj = jwt.verify(req.body.token, syzoj.config.email_jwt_secret, { subject: 'forget' });
    } catch (e) {
      throw 3001;
    }

    let syzoj2_xxx_md5 = '59cb65ba6f9ad18de0dcd12d5ae11bd2';
    if (req.body.password === syzoj2_xxx_md5) throw new ErrorMessage('Mật khẩu không được để trống.');
    const user = await User.findById(obj.userId);
    user.password = req.body.password;
    await user.save();

    res.send(JSON.stringify({ error_code: 1 }));
  } catch (e) {
    syzoj.log(e);
    if (typeof e === 'number') {
      res.send(JSON.stringify({ error_code: e }));
    } else {
      res.send(JSON.stringify({ error_code: 1000 }));
    }
  }
});

app.get('/api/sign_up_confirm', async (req, res) => {
  try {
    let obj;
    try {
      obj = jwt.verify(req.query.token, syzoj.config.email_jwt_secret, { subject: 'register' });
    } catch (e) {
      throw new ErrorMessage('Liên kết xác minh đăng ký không hợp lệ: ' + e.toString());
    }

    let user = await User.fromName(obj.username);
    if (user) throw new ErrorMessage('Tên tài khoản đã được sử dụng.');
    user = await User.findOne({ where: { email: obj.email } });
    if (user) throw new ErrorMessage('Email đã được sử dụng.');

    // Because the salt is "syzoj2_xxx" and the "syzoj2_xxx" 's md5 is"59cb..."
    // the empty password 's md5 will equal "59cb.."
    let syzoj2_xxx_md5 = '59cb65ba6f9ad18de0dcd12d5ae11bd2';
    if (obj.password === syzoj2_xxx_md5) throw new ErrorMessage('Mật khẩu không được để trống.');
    if (!(obj.email = obj.email.trim())) throw new ErrorMessage('Email không được để trống.');
    if (!syzoj.utils.isValidUsername(obj.username)) throw new ErrorMessage('Tên tài khoản không hợp lệ.');

    user = await User.create({
      username: obj.username,
      password: obj.password,
      email: obj.email,
      is_show: syzoj.config.default.user.show,
      rating: syzoj.config.default.user.rating,
      register_time: parseInt((new Date()).getTime() / 1000)
    });
    await user.save();

    req.session.user_id = user.id;
    setLoginCookie(user.username, user.password, res);

    res.redirect(obj.prevUrl || '/');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

// Obslete!!!
app.get('/api/sign_up/:token', async (req, res) => {
  try {
    let obj;
    try {
      let decrypted = syzoj.utils.decrypt(Buffer.from(req.params.token, 'base64'), syzoj.config.email_jwt_secret).toString();
      obj = JSON.parse(decrypted);
    } catch (e) {
      throw new ErrorMessage('Liên kết xác minh đăng ký không hợp lệ.');
    }

    let user = await User.fromName(obj.username);
    if (user) throw new ErrorMessage('Tên tài khoản đã được sử dụng.');
    user = await User.findOne({ where: { email: obj.email } });
    if (user) throw new ErrorMessage('Email đã được sử dụng.');

    // Because the salt is "syzoj2_xxx" and the "syzoj2_xxx" 's md5 is"59cb..."
    // the empty password 's md5 will equal "59cb.."
    let syzoj2_xxx_md5 = '59cb65ba6f9ad18de0dcd12d5ae11bd2';
    if (obj.password === syzoj2_xxx_md5) throw new ErrorMessage('Mật khẩu không được để trống.');
    if (!(obj.email = obj.email.trim())) throw new ErrorMessage('Email không được để trống.');
    if (!syzoj.utils.isValidUsername(obj.username)) throw new ErrorMessage('Tên tài khoản không hợp lệ.');

    user = await User.create({
      username: obj.username,
      password: obj.password,
      email: obj.email,
      public_email: true
    });
    await user.save();

    req.session.user_id = user.id;
    setLoginCookie(user.username, user.password, res);

    res.redirect(obj.prevUrl || '/');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

// Markdown
app.post('/api/markdown', async (req, res) => {
  try {
    let s = await syzoj.utils.markdown(req.body.s.toString());
    res.send(s);
  } catch (e) {
    syzoj.log(e);
    res.send(e);
  }
});

app.get('/static/uploads/answer/:md5', async (req, res) => {
  if (req.params.md5.indexOf('/') !== -1) return res.status(500).send('Not Found');
  try {
    res.sendFile(File.resolvePath('answer', req.params.md5));
  } catch (e) {
    res.status(500).send(e);
  }
});
