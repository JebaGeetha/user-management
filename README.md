# User Management System

## Project Overview

This is a User Management System built using Node.js, Express.js, SQLite, HTML, CSS, and JavaScript.

The application allows users to log in and manage user records through a simple web interface. It also includes a Fibonacci Table page.

## Features

* User login and logout
* Add new users
* Edit user details
* Delete users
* Search users by name or email
* Pagination for the user list
* Active and Inactive user status
* Password hashing using bcrypt
* SQLite database storage
* Fibonacci number table generator

## Technologies Used

* Node.js
* Express.js
* SQLite
* better-sqlite3
* bcrypt
* express-session
* HTML
* CSS
* JavaScript

## Requirements

Install Node.js before running the application.

## Installation

1. Download or clone the project.

2. Open a terminal in the project directory.

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the application:

   ```bash
   node server.js
   ```

5. Open the application in your browser:

   `http://localhost:3000`

## Demo Login

* Email: `admin@example.com`
* Password: `Admin123!`

The demo administrator account is created by the database initialization script if it does not already exist.

## Fibonacci Table

Open the Fibonacci Table page from the Users page. Enter the number of Fibonacci values to generate and click **Generate Table**.

The page displays the requested sequence in a table.

## Database

The application uses SQLite to store user information, including names, email addresses, hashed passwords, account status, and creation dates.

## Assumptions

* Each user must have a unique email address.
* Passwords must contain at least 8 characters when creating a user.
* User passwords are hashed before being stored.
* The user list displays 5 records per page.
* Users can be searched by name or email.
* A logged-in user cannot delete their own account.
* The Fibonacci generator accepts values from 1 to 100.

## Running the Project

Run `node server.js` from the project directory and visit `http://localhost:3000`.

## Future Improvements

* Add automated tests.
* Improve input validation.
* Add role-based access control.
* Use a persistent session store for production.
* Improve deployment and security configuration.
