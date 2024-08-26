require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Replace with your OpenAI API key
});

// Initialize Express app
const app = express();
const port = 3000;

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Function to transcribe audio file
async function transcribeAudio(audioFile) {
    const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: fs.createReadStream(audioFile.path)
    });
    return response.data.text;
}

// Function to generate meeting minutes
async function meetingMinutes(transcription) {
    const abstractSummary = await abstractSummaryExtraction(transcription);
    const keyPoints = await keyPointsExtraction(transcription);
    const actionItems = await actionItemExtraction(transcription);
    const sentiment = await sentimentAnalysis(transcription);
    return {
        abstract_summary: abstractSummary,
        key_points: keyPoints,
        action_items: actionItems,
        sentiment: sentiment
    };
}

// Function to extract abstract summary
async function abstractSummaryExtraction(transcription) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: 'You are a highly skilled AI trained in language comprehension and summarization. I would like you to read the following text and summarize it into a concise abstract paragraph. Aim to retain the most important points, providing a coherent and readable summary that could help a person understand the main points of the discussion without needing to read the entire text. Please avoid unnecessary details or tangential points.'
            },
            {
                role: 'user',
                content: transcription
            }
        ],
        max_tokens: 100
    });
    return response.data.choices[0].message.content;
}

// Function to extract key points
async function keyPointsExtraction(transcription) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: 'You are a proficient AI with a specialty in distilling information into key points. Based on the following text, identify and list the main points that were discussed or brought up. These should be the most important ideas, findings, or topics that are crucial to the essence of the discussion. Your goal is to provide a list that someone could read to quickly understand what was talked about.'
            },
            {
                role: 'user',
                content: transcription
            }
        ]
    });
    return response.data.choices[0].message.content;
}

// Function to extract action items
async function actionItemExtraction(transcription) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: 'You are an AI expert in analyzing conversations and extracting action items. Please review the text and identify any tasks, assignments, or actions that were agreed upon or mentioned as needing to be done. These could be tasks assigned to specific individuals, or general actions that the group has decided to take. Please list these action items clearly and concisely.'
            },
            {
                role: 'user',
                content: transcription
            }
        ]
    });
    return response.data.choices[0].message.content;
}

// Function to analyze sentiment
async function sentimentAnalysis(transcription) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: 'As an AI with expertise in language and emotion analysis, your task is to analyze the sentiment of the following text. Please consider the overall tone of the discussion, the emotion conveyed by the language used, and the context in which words and phrases are used. Indicate whether the sentiment is generally positive, negative, or neutral, and provide brief explanations for your analysis where possible.'
            },
            {
                role: 'user',
                content: transcription
            }
        ]
    });
    return response.data.choices[0].message.content;
}

// Function to save minutes as a DOCX file
function saveAsDocx(minutes, filename) {
    const doc = new Document();
    for (const [key, value] of Object.entries(minutes)) {
        const heading = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        doc.addSection({
            children: [
                new Paragraph({
                    text: heading,
                    heading: HeadingLevel.HEADING_1
                }),
                new Paragraph({
                    text: value
                }),
                new Paragraph() // Add a line break between sections
            ]
        });
    }
    Packer.toBuffer(doc).then(buffer => {
        fs.writeFileSync(filename, buffer);
    });
}

// Express routes
app.post('/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        let combinedTranscript = '';

        for (const file of files) {
            const transcript = await transcribeAudio(file);
            combinedTranscript += transcript;
        }

        const minutes = await meetingMinutes(combinedTranscript);
        const filename = 'meeting_minutes.docx';
        saveAsDocx(minutes, filename);

        res.sendFile(path.join(__dirname, filename));
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
