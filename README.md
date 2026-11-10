# Health Monitoring System

## Overview

The Health Monitoring System is a web-based application designed to help users track, manage, and monitor their health data in real time. The system allows users to input vital health parameters, view historical records, and receive insights based on their data.

This project uses:

* **Backend:** Python
* **Frontend:** HTML, CSS, JavaScript

---

## Features

* User registration and login
* Input and tracking of health metrics (e.g., heart rate, blood pressure, temperature)
* Real-time data updates
* Dashboard for visualization of health data
* Data storage and retrieval
* Alerts for abnormal health readings (optional feature)

---

## Technologies Used

### Backend

* Python
* Flask / Django (depending on your implementation)
* RESTful APIs

### Frontend

* HTML (structure)
* CSS (styling)
* JavaScript (interactivity and dynamic updates)

### Database

* SQLite / MySQL / PostgreSQL (choose based on your setup)

---

## System Architecture

The system follows a client-server architecture:

1. The frontend (HTML, CSS, JavaScript) handles user interaction.
2. The backend (Python) processes requests and handles business logic.
3. The database stores user and health data.
4. APIs connect the frontend and backend.

---

## Run locally

### Prerequisites

* Python 3.x installed
* Web browser (Chrome, Firefox, etc.)
* VS Code Live Server extension (or another static HTTP server)

### Steps

1. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate       # Linux/macOS
   .venv\Scripts\activate          # Windows
   ```

2. Install the backend dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Start the website and API from the project directory:

   ```bash
   python main.py
   ```

   Open `http://127.0.0.1:8000` for the website. Interactive API
   documentation is available at `http://127.0.0.1:8000/docs`.

The same server serves the frontend and API, so no separate frontend server is
required. If you prefer VS Code Live Server or another static server, you can
still use it to serve the frontend separately:

4. Visit the site, register, and sign in. You can then save readings from the
   dashboard, view them on the History page, and change the alert threshold on
   the Settings page. The Contact form sends messages to the API.

The API stores data in `health_monitor.sqlite3` beside `main.py`. Keep this
file private; it contains account and health data. The frontend defaults to
the API at `http://127.0.0.1:8000`. To use another API URL, define
`window.HEALTHMONITOR_API_URL` before loading `api.js`.
---

## Usage

* Register or log in from the homepage.
* Record vital readings on the dashboard.
* Review and clear your saved readings on the History page.
* Update your heart-rate alert threshold on the Settings page.
* Submit questions using either Contact form.

---

## Project Structure

```
health-monitoring-system/
├── main.py
├── api.js
├── index.html
├── script.js
├── style.css
├── history.html
├── history.js
├── settings.html
├── settings.js
├── contact.html
├── contact.js
├── requirements.txt
└── README.md
```

---

## API Endpoints

* `POST /register` and `POST /login` – Create an account and sign in
* `POST /logout` and `GET /me` – End a session and read the current profile
* `POST /vitals` and `GET /vitals` – Save a reading and retrieve the latest reading
* `GET /history` and `DELETE /history` – Read or clear the signed-in user's readings
* `GET /settings` and `POST /update_settings` – Read or update the heart-rate alert threshold
* `POST /contact` – Submit a contact message

---

## Future Improvements

* Integration with wearable devices
* AI-based health predictions
* Mobile application version
* Enhanced data visualization

---

## Contributing

Contributions are welcome. Please fork the repository and submit a pull request.

---

## License

This project is licensed under the MIT License.

---

## Author

Developed by: [Kimutai Nathan Kiplimo]

---

## Acknowledgements

* Open-source libraries and frameworks
* Inspiration from modern health tracking systems
