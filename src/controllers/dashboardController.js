module.exports = {
    analyses: (req, res) => {
        res.render('dashboard/analyses', {title: 'test', styles: [ '/pages/restricted/dashboard/analyses.css' ], scripts: [ '/pages/restricted/dashboard/analyses.js' ] });
    }
}