let ProblemTag = syzoj.model('problem_tag');

app.get('/problems/tag/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_problem_tag')) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let id = parseInt(req.params.id) || 0;
    let tag = await ProblemTag.findById(id);

    if (!tag) {
      tag = await ProblemTag.create();
      tag.id = id;
    }

    res.render('problem_tag_edit', {
      tag: tag
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/problems/tag/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_problem_tag')) throw new ErrorMessage('Bạn không có quyền thực hiện thao tác này.');

    let id = parseInt(req.params.id) || 0;
    let tag = await ProblemTag.findById(id);

    if (!tag) {
      tag = await ProblemTag.create();
      tag.id = id;
    }

    req.body.name = req.body.name.trim();
    if (tag.name !== req.body.name) {
      if (await ProblemTag.findOne({ where: { name: req.body.name } })) {
        throw new ErrorMessage('Thẻ đã được sử dụng.');
      }
    }

    tag.name = req.body.name;
    tag.color = req.body.color;

    await tag.save();

    res.redirect(syzoj.utils.makeUrl(['problems', 'tag', tag.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
