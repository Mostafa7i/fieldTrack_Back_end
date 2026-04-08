const Student = require('../models/Student');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const User = require('../models/User');

// Helper to make Gemini API requests using fetch (No external SDK needed)
const generateContent = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini API Error');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};

// 1. AI Chat Assistant
exports.chatAssistant = async (req, res) => {
  try {
    const { message, context } = req.body;
    const userRole = req.user.role;
    
    const systemPrompt = `You are an intelligent assistant for the FieldTrack system. 
You are currently talking to a user with the role: ${userRole}. 
Always be helpful, professional, and concise. 
User context: ${JSON.stringify(context || {})}`;

    try {
      const responseText = await generateContent(`System instructions: ${systemPrompt}\n\nUser: ${message}`);
      res.json({ reply: responseText });
    } catch (e) {
      if (e.message === 'GEMINI_API_KEY_MISSING') {
        return res.status(503).json({ message: "AI capabilities are currently disabled. Please add GEMINI_API_KEY to your server's .env file." });
      }
      throw e;
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'Error processing AI request', error: error.message });
  }
};

// 2. AI Student Filter & Application Evaluation (For Companies)
exports.evaluateApplicant = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('internship');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const studentCustomData = await Student.findOne({ user: application.student._id });
    
    if (!studentCustomData) {
      return res.status(404).json({ message: 'Student details not found' });
    }

    const internshipDetails = application.internship;
    
    const prompt = `
You are an expert HR AI evaluator for an internship portal.
Please evaluate how well this student matches the internship requirements.

Internship Title: ${internshipDetails.title}
Internship Description: ${internshipDetails.description}
Internship Requirements: ${internshipDetails.requirements}
Internship Skills: ${internshipDetails.skills.join(', ')}

Student Major/Faculty: ${studentCustomData.major} / ${studentCustomData.faculty}
Student GPA: ${studentCustomData.gpa}
Student Skills: ${studentCustomData.skills.join(', ')}
Student Bio: ${studentCustomData.bio}

Based on this, respond strictly with a valid JSON object in the following format (no markdown code blocks, just raw JSON):
{
  "matchScore": <number between 0 and 100>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommendation": "<short summary>"
}`;

    let aiResultText;
    try {
      aiResultText = await generateContent(prompt);
    } catch (e) {
      if (e.message === 'GEMINI_API_KEY_MISSING') {
        return res.status(503).json({ message: "Configure GEMINI_API_KEY in .env to use AI evaluation." });
      }
      throw e;
    }

    aiResultText = aiResultText.trim();
    if(aiResultText.startsWith('\`\`\`json')){
      aiResultText = aiResultText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(aiResultText);
    } catch (e) {
      console.error("Failed to parse AI JSON:", aiResultText);
      return res.status(500).json({ message: 'Failed to generate a readable AI evaluation.' });
    }

    res.json(parsedResult);
  } catch (error) {
    console.error('AI Evaluation Error:', error);
    res.status(500).json({ message: 'Error evaluating applicant', error: error.message });
  }
};

// 3. AI Recommendations for Students
exports.recommendInternships = async (req, res) => {
  try {
    const studentId = req.user.id;
    const locale = req.query.locale || 'en';

    const student = await Student.findOne({ user: studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Fetch all open internships
    const openInternships = await Internship.find({ status: 'open' }).limit(30);
    
    if (openInternships.length === 0) {
      return res.json({ recommendations: [], message: "No open internships available." });
    }

    // Minimize data to save tokens
    const miniInternships = openInternships.map(i => ({
      id: i._id,
      title: i.title,
      skills: i.skills,
      category: i.category
    }));

    const prompt = `
You are an AI career advisor. Based on the student's profile, pick the top 5 most suitable internships from the provided list.

Student Profile:
Major: ${student.major}
Skills: ${student.skills.join(', ')}

Available Internships (JSON):
${JSON.stringify(miniInternships)}

Respond strictly with a valid JSON array containing objects with the following format (no markdown code blocks):
[
  {
    "internshipId": "<id of the internship>",
    "reasoning": "<1 sentence explaining why it's a good match. MUST BE WRITTEN IN ${locale === 'ar' ? 'ARABIC' : 'ENGLISH'}>"
  }
]`;

    let aiResultText;
    try {
      aiResultText = await generateContent(prompt);
    } catch (e) {
      if (e.message === 'GEMINI_API_KEY_MISSING') {
        return res.status(503).json({ message: "Configure GEMINI_API_KEY in .env to see personalized recommendations." });
      }
      throw e;
    }

    aiResultText = aiResultText.trim();
    if(aiResultText.startsWith('\`\`\`json')){
      aiResultText = aiResultText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    }

    let recommendedList;
    try {
      recommendedList = JSON.parse(aiResultText);
    } catch (e) {
      return res.status(500).json({ message: 'Failed to process recommendations' });
    }

    // Attach full internship data
    const finalRecommendations = recommendedList.map(rec => {
      const fullDetails = openInternships.find(i => i._id.toString() === rec.internshipId);
      return {
        ...rec,
        internshipDetails: fullDetails
      };
    }).filter(rec => rec.internshipDetails);

    res.json(finalRecommendations);
  } catch (error) {
    console.error('AI Recommendations Error:', error);
    res.status(500).json({ message: 'Error generating recommendations', error: error.message });
  }
};
