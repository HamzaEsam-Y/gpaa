const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync("admin1234", 10);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// الاتصال بقاعدة بيانات SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error("خطأ في الاتصال بقاعدة البيانات:", err.message);
    } else {
        console.log("تم الاتصال بقاعدة بيانات SQLite بنجاح.");
        initDb();
    }
});

// تهيئة الجدول
function initDb() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_code TEXT NOT NULL,
                student_name TEXT NOT NULL,
                batch TEXT NOT NULL,
                academic_year TEXT DEFAULT '2024 / 2025',
                term_gpa REAL NOT NULL,
                cumulative_gpa REAL NOT NULL,
                total_credits INTEGER NOT NULL,
                academic_standing TEXT NOT NULL,
                max_allowed_hours INTEGER NOT NULL,
                courses_json TEXT NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });
}

// حفظ بيانات الطالب
app.post('/api/student/save', (req, res) => {
    const {
        student_code,
        student_name,
        batch,
        academic_year,
        term_gpa,
        cumulative_gpa,
        total_credits,
        academic_standing,
        max_allowed_hours,
        courses,
        notes
    } = req.body;

    if (!student_code || !student_name || cumulative_gpa === undefined) {
        return res.status(400).json({ error: "البيانات الأساسية للطالب غير مكتملة" });
    }

    const query = `
        INSERT INTO students (
            student_code, student_name, batch, academic_year, term_gpa,
            cumulative_gpa, total_credits, academic_standing,
            max_allowed_hours, courses_json, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const coursesJson = JSON.stringify(courses || []);

    db.run(
        query,
        [
            student_code.trim(),
            student_name.trim(),
            batch,
            academic_year || '2024 / 2025',
            term_gpa,
            cumulative_gpa,
            total_credits,
            academic_standing,
            max_allowed_hours,
            coursesJson,
            notes || ''
        ],
        function (err) {
            if (err) {
                console.error("فشل حفظ البيانات:", err);
                return res.status(500).json({ error: "فشل الحفظ في قاعدة البيانات" });
            }
            res.json({
                success: true,
                message: "تم حفظ بيانات الطالب وسجل الـ GPA بنجاح في قاعدة البيانات",
                recordId: this.lastID
            });
        }
    );
});

// تسجيل دخول الأدمن
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
        return res.json({
            success: true,
            token: "admin-auth-session-hti-2022",
            message: "تم تسجيل الدخول بنجاح كمسؤول"
        });
    }
    return res.status(401).json({ success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
});

// وسيط حماية للأدمن
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader === "Bearer admin-auth-session-hti-2022") {
        next();
    } else {
        res.status(403).json({ error: "غير مصرح بالدخول - هذه الصفحة للأدمن فقط" });
    }
}

// جلب سجلات الطلاب
app.get('/api/admin/students', requireAdmin, (req, res) => {
    const query = `SELECT * FROM students ORDER BY created_at DESC`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "خطأ في قراءة بيانات الطلاب" });
        }
        const parsedRows = rows.map(r => ({
            ...r,
            courses: JSON.parse(r.courses_json || '[]')
        }));
        res.json({ success: true, students: parsedRows });
    });
});

// حذف سجل طالب
app.delete('/api/admin/student/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM students WHERE id = ?`, [id], function (err) {
        if (err) {
            return res.status(500).json({ error: "فشل حذف السجل" });
        }
        res.json({ success: true, message: "تم حذف السجل بنجاح" });
    });
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 نظام حساب الـ GPA ولوحة الأدمن يعمل بنجاح!`);
    console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
    console.log(`====================================================`);
});