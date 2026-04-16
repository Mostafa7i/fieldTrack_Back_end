const mongoose = require('mongoose');
const Application = require('./models/Application');
const Student = require('./models/Student');
const Internship = require('./models/Internship');
const User = require('./models/User'); // Required for populate

mongoose.connect('mongodb://127.0.0.1:27017/fieldtrack').then(async () => {
  try {
    const apps = await Application.find();
    if (apps.length === 0) { console.log('No apps'); return; }
    
    for (const app of apps) {
       let errorDetected = null;
       try {
         const application = await Application.findById(app._id)
            .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
            .populate('internship');

         if (!application) continue;
         if (!application.student || !application.student._id) continue;

         const studentCustomData = await Student.findOne({ user: application.student._id });
         if (!studentCustomData) continue;

         const internshipDetails = application.internship;
         if (!internshipDetails) continue;

         const studentSkillsArr = studentCustomData.skills || [];
         const internSkillsArr = internshipDetails.skills || [];

         const studentSkills = studentSkillsArr.map(s => (s || '').toString().toLowerCase());
         const internSkills = internSkillsArr.map(s => (s || '').toString().toLowerCase());

         const matchedSkills = internSkills.filter(sk => studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));
         const missingSkills = internSkills.filter(sk => !studentSkills.some(ss => ss.includes(sk) || sk.includes(ss)));

         let matchScore = 0;
         if (internSkills.length > 0) {
            matchScore += Math.round((matchedSkills.length / internSkills.length) * 80);
         } else {
            matchScore += 60;
         }
         
         const gpa = Number(studentCustomData.gpa) || 0;
         if (gpa > 0) matchScore += Math.round((gpa / 4) * 20);
         else matchScore += 10;

         matchScore = Math.min(matchScore, 100);

         const strengths = [];
         const weaknesses = [];

         if (matchedSkills.length > 0) strengths.push(`Possesses ${matchedSkills.length} skills`);
         if (gpa >= 3.0) strengths.push(`GPA: ${gpa}`);
         if (studentCustomData.major) strengths.push(`Major ${studentCustomData.major}`);

         if (missingSkills.length > 0) weaknesses.push(`Missing skills`);
         if (studentSkillsArr.length === 0) weaknesses.push(`No skills`);

         console.log('App', app._id, 'Fallback is OK');
       } catch(e) {
         console.log('Crash generating fallback:', e.stack);
         errorDetected = e;
       }
       if (errorDetected) break;
    }
  } catch(e) {
    console.log('Outer err:', e.stack);
  } finally {
    process.exit(0);
  }
}).catch(console.error);
