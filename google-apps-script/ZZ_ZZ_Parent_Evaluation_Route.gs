function doGet(e) {
  const p = (e && e.parameter) || {};

  if (String(p.mode || '').toLowerCase() === 'parent') {
    return HtmlService.createHtmlOutputFromFile('Parent_Evaluation')
      .setTitle('ระบบแปลผลการประเมินผู้ปกครอง วพอ.พอ.')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (p.action || p.callback) return apiGet_(p);

  return HtmlService.createHtmlOutput(buildUploadPage_())
    .setTitle('RTAFNC Evaluation Analyzer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}