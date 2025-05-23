import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = 3000;

const STUDENT_ID = '6486352';
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjY0ODYzNTIsImlzcyI6Imh0dHBzOi8vYWJlcy5wbGF0Zm9ybS5zaW1wbGlmaWkuY29tL2FwaS92MS9hZG1pbi9hdXRoZW50aWNhdGUiLCJpYXQiOjE3NDgwMDIwODAsImV4cCI6MTgwODQ4MjA4MCwibmJmIjoxNzQ4MDAyMDgwLCJqdGkiOiIxUnJFOEVSZjJtVmxOMUo2In0.H9OCe3npA1H5-39k1azbFK2VYV8uS6XviLa4mB0NK8g'; // Replace with your full token

// Step 1: fetch all subjects for the student
async function fetchSubjects(): Promise<{ name: string; cfId: number }[]> {
  const res = await axios.get(
    'https://abes.platform.simplifii.com/api/v1/custom/getCFMappedWithStudentID',
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'User-Agent': 'PostmanRuntime/7.44.0',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
      },
    }
  );

  return res.data.response.data.map((entry: any) => ({
    name: entry.cdata.course_name.trim(),
    cfId: entry.id,
  }));
}

// Step 2: fetch attendance for all subjects and compute summary
app.get('/all-attendance', async (_req: Request, res: Response) => {
  try {
    const subjects = await fetchSubjects();

    let grand_present = 0;
    let grand_absent = 0;

    const rawResults = await Promise.all(
      subjects.map(sub =>
        axios
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
          .then(r => ({
            subject: sub.name,
            data: r.data.response?.data || [],
          }))
      )
    );

    const attendanceSummary = rawResults.reduce((out, { subject, data }) => {
    interface AttendanceRecord {
        state: 'Present' | 'Absent';
        start_time?: string;
        date_formatted?: string;
    }
    const total_present: number = data.filter((d: AttendanceRecord) => d.state === 'Present').length;
    const total_absent: number = data.filter((d: AttendanceRecord) => d.state === 'Absent').length;

      // Accumulate grand totals
      grand_present += total_present;
      grand_absent += total_absent;

      const byDate: Record<string, { present: number; absent: number }> = {};

    interface ByDateRecord {
        present: number;
        absent: number;
    }

    interface AttendanceObj {
        state: 'Present' | 'Absent';
        start_time?: string;
        date_formatted?: string;
    }

    data.forEach((d: AttendanceObj) => {
        const dt = new Date(d.start_time || (d.date_formatted ? d.date_formatted.split(' ').pop()! : ''));
        const date = dt.toISOString().slice(0, 10);
        if (!byDate[date]) byDate[date] = { present: 0, absent: 0 } as ByDateRecord;
        if (d.state === 'Present') byDate[date].present++;
        else if (d.state === 'Absent') byDate[date].absent++;
    });

      const daily = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));

      out[subject] = { total_present, total_absent, daily };
      return out;
    }, {} as Record<string, {
      total_present: number;
      total_absent: number;
      daily: { date: string; present: number; absent: number }[];
    }>);

    // Add global totals at the top level
    res.json({
      total_present_all_subjects: grand_present,
      total_absent_all_subjects: grand_absent,
      subjects: attendanceSummary
    });
  } catch (err: any) {
    console.error('Error in /all-attendance:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch/process attendance' });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
