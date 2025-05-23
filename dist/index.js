"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const PORT = 3000;
const STUDENT_ID = '6486352';
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjY0ODYzNTIsImlzcyI6Imh0dHBzOi8vYWJlcy5wbGF0Zm9ybS5zaW1wbGlmaWkuY29tL2FwaS92MS9hZG1pbi9hdXRoZW50aWNhdGUiLCJpYXQiOjE3NDgwMDIwODAsImV4cCI6MTgwODQ4MjA4MCwibmJmIjoxNzQ4MDAyMDgwLCJqdGkiOiIxUnJFOEVSZjJtVmxOMUo2In0.H9OCe3npA1H5-39k1azbFK2VYV8uS6XviLa4mB0NK8g'; // Replace with your full token
// Step 1: fetch all subjects for the student
function fetchSubjects() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axios_1.default.get('https://abes.platform.simplifii.com/api/v1/custom/getCFMappedWithStudentID', {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                'User-Agent': 'PostmanRuntime/7.44.0',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                Connection: 'keep-alive',
            },
        });
        return res.data.response.data.map((entry) => ({
            name: entry.cdata.course_name.trim(),
            cfId: entry.id,
        }));
    });
}
// Step 2: fetch attendance for all subjects and compute summary
app.get('/all-attendance', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const subjects = yield fetchSubjects();
        let grand_present = 0;
        let grand_absent = 0;
        const rawResults = yield Promise.all(subjects.map(sub => axios_1.default
            .get('https://abes.platform.simplifii.com/api/v1/cards', {
            params: {
                type: 'Attendance',
                sort_by: '-datetime1',
                report_title: sub.name,
                equalto___fk_student: STUDENT_ID,
                equalto___cf_id: sub.cfId,
                token: TOKEN,
            },
            headers: {
                'User-Agent': 'PostmanRuntime/7.44.0',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                Connection: 'keep-alive',
            },
        })
            .then(r => {
            var _a;
            return ({
                subject: sub.name,
                data: ((_a = r.data.response) === null || _a === void 0 ? void 0 : _a.data) || [],
            });
        })));
        const attendanceSummary = rawResults.reduce((out, { subject, data }) => {
            const total_present = data.filter((d) => d.state === 'Present').length;
            const total_absent = data.filter((d) => d.state === 'Absent').length;
            // Accumulate grand totals
            grand_present += total_present;
            grand_absent += total_absent;
            const byDate = {};
            data.forEach((d) => {
                const dt = new Date(d.start_time || (d.date_formatted ? d.date_formatted.split(' ').pop() : ''));
                const date = dt.toISOString().slice(0, 10);
                if (!byDate[date])
                    byDate[date] = { present: 0, absent: 0 };
                if (d.state === 'Present')
                    byDate[date].present++;
                else if (d.state === 'Absent')
                    byDate[date].absent++;
            });
            const daily = Object.entries(byDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, counts]) => (Object.assign({ date }, counts)));
            out[subject] = { total_present, total_absent, daily };
            return out;
        }, {});
        // Add global totals at the top level
        res.json({
            total_present_all_subjects: grand_present,
            total_absent_all_subjects: grand_absent,
            subjects: attendanceSummary
        });
    }
    catch (err) {
        console.error('Error in /all-attendance:', ((_a = err.response) === null || _a === void 0 ? void 0 : _a.data) || err.message);
        res.status(500).json({ error: 'Failed to fetch/process attendance' });
    }
}));
app.listen(PORT, () => {
    console.log(`✅ Server listening at http://localhost:${PORT}`);
});
