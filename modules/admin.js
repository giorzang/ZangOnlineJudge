const objectPath = require('object-path');
let Problem = syzoj.model('problem');
let JudgeState = syzoj.model('judge_state');
let Article = syzoj.model('article');
let Contest = syzoj.model('contest');
let User = syzoj.model('user');
let UserPrivilege = syzoj.model('user_privilege');
const RatingCalculation = syzoj.model('rating_calculation');
const RatingHistory = syzoj.model('rating_history');
let ContestPlayer = syzoj.model('contest_player');
const calcRating = require('../libs/rating');

app.get('/admin/info', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let allSubmissionsCount = await JudgeState.count();
    let todaySubmissionsCount = await JudgeState.count({
      submit_time: TypeORM.MoreThanOrEqual(syzoj.utils.getCurrentDate(true))
    });
    let problemsCount = await Problem.count();
    let articlesCount = await Article.count();
    let contestsCount = await Contest.count();
    let usersCount = await User.count();

    res.render('admin_info', {
      allSubmissionsCount: allSubmissionsCount,
      todaySubmissionsCount: todaySubmissionsCount,
      problemsCount: problemsCount,
      articlesCount: articlesCount,
      contestsCount: contestsCount,
      usersCount: usersCount
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

let configItems = {
  'title': { name: 'Tiêu đề trang', type: String },
  'google_analytics': { name: 'Google Analytics', type: String },
  'Thông số mặc định': null,
  'default.problem.time_limit': { name: 'Giới hạn thời gian（Đơn vị：ms）', type: Number },
  'default.problem.memory_limit': { name: 'Giới hạn bộ nhớ（Đơn vị：MiB）', type: Number },
  'Giới hạn': null,
  'limit.time_limit': { name: 'Thời gian tối đa（Đơn vị：ms）', type: Number },
  'limit.memory_limit': { name: 'Bộ nhớ tối đa（Đơn vị：MiB）', type: Number },
  'limit.data_size': { name: 'Kích thước dữ liệu（Đơn vị：byte）', type: Number },
  'limit.testdata': { name: 'Kích thước dữ liệu test（Đơn vị：byte）', type: Number },
  'limit.submit_code': { name: 'Độ dài code（Đơn vị：byte）', type: Number },
  'limit.submit_answer': { name: 'Kích thước đáp án（Đơn vị：byte）', type: Number },
  'limit.custom_test_input': { name: 'Kích thước tệp đầu vào tùy chỉnh（Đơn vị：byte）', type: Number },
  'limit.testdata_filecount': { name: 'Số lượng tệp dữ liệu test（Đơn vị：byte）', type: Number },
  'Số lượng hiển thị trên mỗi trang': null,
  'page.problem': { name: 'Bài tập', type: Number },
  'page.judge_state': { name: 'Đánh giá', type: Number },
  'page.problem_statistics': { name: 'Thống kê', type: Number },
  'page.ranklist': { name: 'Xếp hạng', type: Number },
  'page.discussion': { name: 'Thảo luận', type: Number },
  'page.article_comment': { name: 'Bình luận', type: Number },
  'page.contest': { name: 'Cuộc thi', type: Number }
};

app.get('/admin/config', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    for (let i in configItems) {
      if (!configItems[i]) continue;
      configItems[i].val = objectPath.get(syzoj.config, i);
    }

    res.render('admin_config', {
      items: configItems
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/config', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    for (let i in configItems) {
      if (!configItems[i]) continue;
      if (req.body[i]) {
        let val;
        if (configItems[i].type === Boolean) {
          val = req.body[i] === 'on';
        } else if (configItems[i].type === Number) {
          val = Number(req.body[i]);
        } else {
          val = req.body[i];
        }

        const oldVal = objectPath.get(syzoj.config, i);
        if (oldVal !== val)
          objectPath.set(syzoj.configInFile, i, val);
      }
    }

    syzoj.reloadConfig();
    await syzoj.utils.saveConfig();

    res.redirect(syzoj.utils.makeUrl(['admin', 'config']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/privilege', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let a = await UserPrivilege.find();
    let users = {};
    for (let p of a) {
      if (!users[p.user_id]) {
        users[p.user_id] = {
          user: await User.findById(p.user_id),
          privileges: []
        };
      }

      users[p.user_id].privileges.push(p.privilege);
    }

    res.render('admin_privilege', {
      users: Object.values(users)
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/privilege', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let data = JSON.parse(req.body.data);
    for (let id in data) {
      let user = await User.findById(id);
      if (!user) throw new ErrorMessage(`Không có người dùng nào có ID : ${id} .`);
      await user.setPrivileges(data[id]);
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'privilege']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/rating', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');
    const contests = await Contest.find({
      order: {
        start_time: 'DESC'
      }
    });
    const calcs = await RatingCalculation.find({
      order: {
        id: 'DESC'
      }
    });
    for (const calc of calcs) await calc.loadRelationships();

    res.render('admin_rating', {
      contests: contests,
      calcs: calcs
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/rating/add', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');
    const contest = await Contest.findById(req.body.contest);
    if (!contest) throw new ErrorMessage('Không có cuộc thi');

    await contest.loadRelationships();
    const newcalc = await RatingCalculation.create({ contest_id: contest.id });
    await newcalc.save();

    if (!contest.ranklist || contest.ranklist.ranklist.player_num <= 1) {
      throw new ErrorMessage("Có quá ít người dự thi.");
    }

    const players = [];
    for (let i = 1; i <= contest.ranklist.ranklist.player_num; i++) {
      const user = await User.findById((await ContestPlayer.findById(contest.ranklist.ranklist[i])).user_id);
      players.push({
        user: user,
        rank: i,
        currentRating: user.rating
      });
    }
    const newRating = calcRating(players);
    for (let i = 0; i < newRating.length; i++) {
      const user = newRating[i].user;
      user.rating = newRating[i].currentRating;
      await user.save();
      const newHistory = await RatingHistory.create({
        rating_calculation_id: newcalc.id,
        user_id: user.id,
        rating_after: newRating[i].currentRating,
        rank: newRating[i].rank
      });
      await newHistory.save();
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'rating']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/admin/rating/delete', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');
    const calcList = await RatingCalculation.find({
      where: {
        id: TypeORM.MoreThanOrEqual(req.body.calc_id)
      },
      order: {
        id: 'DESC'
      }
    });
    if (calcList.length === 0) throw new ErrorMessage('ID không đúng');

    for (let i = 0; i < calcList.length; i++) {
      await calcList[i].delete();
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'rating']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/admin/other', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    res.render('admin_other');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/rejudge', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    res.render('admin_rejudge', {
      form: {},
      count: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/other', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    if (req.body.type === 'reset_count') {
      const problems = await Problem.find();
      for (const p of problems) {
        await p.resetSubmissionCount();
      }
    } else if (req.body.type === 'reset_discussion') {
      const articles = await Article.find();
      for (const a of articles) {
        await a.resetReplyCountAndTime();
      }
    } else if (req.body.type === 'reset_codelen') {
      const submissions = await JudgeState.find();
      for (const s of submissions) {
        if (s.type !== 'submit-answer') {
          s.code_length = Buffer.from(s.code).length;
          await s.save();
        }
      }
    } else {
      throw new ErrorMessage("Loại hoạt động không chính xác");
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'other']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});
app.post('/admin/rejudge', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let query = JudgeState.createQueryBuilder();

    let user = await User.fromName(req.body.submitter || '');
    if (user) {
      query.andWhere('user_id = :user_id', { user_id: user.id });
    } else if (req.body.submitter) {
      query.andWhere('user_id = :user_id', { user_id: 0 });
    }

    let minID = parseInt(req.body.min_id);
    if (!isNaN(minID)) query.andWhere('id >= :minID', { minID })
    let maxID = parseInt(req.body.max_id);
    if (!isNaN(maxID)) query.andWhere('id <= :maxID', { maxID })

    let minScore = parseInt(req.body.min_score);
    if (!isNaN(minScore)) query.andWhere('score >= :minScore', { minScore });
    let maxScore = parseInt(req.body.max_score);
    if (!isNaN(maxScore)) query.andWhere('score <= :maxScore', { maxScore });

    let minTime = syzoj.utils.parseDate(req.body.min_time);
    if (!isNaN(minTime)) query.andWhere('submit_time >= :minTime', { minTime: parseInt(minTime) });
    let maxTime = syzoj.utils.parseDate(req.body.max_time);
    if (!isNaN(maxTime)) query.andWhere('submit_time <= :maxTime', { maxTime: parseInt(maxTime) });

    if (req.body.language) {
      if (req.body.language === 'submit-answer') {
        query.andWhere(new TypeORM.Brackets(qb => {
          qb.orWhere('language = :language', { language: '' })
            .orWhere('language IS NULL');
        }));
      } else if (req.body.language === 'non-submit-answer') {
        query.andWhere('language != :language', { language: '' })
             .andWhere('language IS NOT NULL');;
      } else {
        query.andWhere('language = :language', { language: req.body.language });
      }
    }

    if (req.body.status) {
      query.andWhere('status = :status', { status: req.body.status });
    }

    if (req.body.problem_id) {
      query.andWhere('problem_id = :problem_id', { problem_id: parseInt(req.body.problem_id) || 0 })
    }

    let count = await JudgeState.countQuery(query);
    if (req.body.type === 'rejudge') {
      let submissions = await JudgeState.queryAll(query);
      for (let submission of submissions) {
        await submission.rejudge();
      }
    }

    res.render('admin_rejudge', {
      form: req.body,
      count: count
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/links', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    res.render('admin_links', {
      links: syzoj.config.links || []
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/links', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    if (JSON.stringify(syzoj.config.links) !== req.body.data) {
      syzoj.configInFile.links = JSON.parse(req.body.data);
      syzoj.reloadConfig();
      await syzoj.utils.saveConfig();
    }

    res.redirect(syzoj.utils.makeUrl(['admin', 'links']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/raw', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    res.render('admin_raw', {
      data: JSON.stringify(syzoj.configInFile, null, 2)
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/raw', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    syzoj.configInFile = JSON.parse(req.body.data);
    syzoj.reloadConfig();
    await syzoj.utils.saveConfig();

    res.redirect(syzoj.utils.makeUrl(['admin', 'raw']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.post('/admin/restart', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    syzoj.restart();

    res.render('admin_restart');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});

app.get('/admin/serviceID', async (req, res) => {
  try {
    if (!res.locals.user || !res.locals.user.is_admin) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    res.send({
        serviceID: syzoj.serviceID
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    })
  }
});
