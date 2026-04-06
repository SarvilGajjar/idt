#!/usr/bin/env node
/*
 Seed books into Firestore.

 Usage:
  node scripts/seed_books.js --service ./serviceAccountKey.json --file ./books.json
 If --file omitted, uses embedded sample data.
*/

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const DEFAULT_DATA = {
  books: [
    { id: 1, title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Fiction', year: 1960, image: 'https://covers.openlibrary.org/b/isbn/9780061120084-M.jpg' },
    { id: 2, title: '1984', author: 'George Orwell', genre: 'Dystopian', year: 1949, image: 'https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg' },
    { id: 3, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'Classic', year: 1925, image: 'https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg' },
    { id: 4, title: 'The Alchemist', author: 'Paulo Coelho', genre: 'Adventure', year: 1988, image: 'https://covers.openlibrary.org/b/isbn/9780061122415-M.jpg' },
    { id: 5, title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', genre: 'Fantasy', year: 1997, image: 'https://covers.openlibrary.org/b/isbn/9780590353427-M.jpg' },
    { id: 6, title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', year: 1937, image: 'https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg' },
    { id: 7, title: 'The Catcher in the Rye', author: 'J.D. Salinger', genre: 'Fiction', year: 1951, image: 'https://covers.openlibrary.org/b/isbn/9780316769488-M.jpg' },
    { id: 8, title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Romance', year: 1813, image: 'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg' },
    { id: 9, title: 'The Da Vinci Code', author: 'Dan Brown', genre: 'Thriller', year: 2003, image: 'https://covers.openlibrary.org/b/isbn/9780307474278-M.jpg' },
    { id: 10, title: 'The Hunger Games', author: 'Suzanne Collins', genre: 'Sci-Fi', year: 2008, image: 'https://covers.openlibrary.org/b/isbn/9780439023528-M.jpg' },
    { id: 11, title: 'The Fault in Our Stars', author: 'John Green', genre: 'Romance', year: 2012, image: 'https://covers.openlibrary.org/b/isbn/9780142424179-M.jpg' },
    { id: 12, title: 'The Kite Runner', author: 'Khaled Hosseini', genre: 'Drama', year: 2003, image: 'https://covers.openlibrary.org/b/isbn/9781594631931-M.jpg' },
    { id: 13, title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'History', year: 2011, image: 'https://covers.openlibrary.org/b/isbn/9780062316097-M.jpg' },
    { id: 14, title: 'Atomic Habits', author: 'James Clear', genre: 'Self-help', year: 2018, image: 'https://covers.openlibrary.org/b/isbn/9780735211292-M.jpg' },
    { id: 15, title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', genre: 'Finance', year: 1997, image: 'https://covers.openlibrary.org/b/isbn/9781612680194-M.jpg' },
    { id: 16, title: 'Think and Grow Rich', author: 'Napoleon Hill', genre: 'Motivation', year: 1937, image: 'https://covers.openlibrary.org/b/isbn/9781585424337-M.jpg' },
    { id: 17, title: 'The Power of Now', author: 'Eckhart Tolle', genre: 'Spiritual', year: 1997, image: 'https://covers.openlibrary.org/b/isbn/9781577314806-M.jpg' },
    { id: 18, title: 'Deep Work', author: 'Cal Newport', genre: 'Productivity', year: 2016, image: 'https://covers.openlibrary.org/b/isbn/9781455586691-M.jpg' },
    { id: 19, title: 'Clean Code', author: 'Robert C. Martin', genre: 'Programming', year: 2008, image: 'https://covers.openlibrary.org/b/isbn/9780132350884-M.jpg' },
    { id: 20, title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', genre: 'Education', year: 2009, image: 'https://covers.openlibrary.org/b/isbn/9780262033848-M.jpg' },
    { id: 21, title: 'The Pragmatic Programmer', author: 'Andrew Hunt', genre: 'Programming', year: 1999, image: 'https://covers.openlibrary.org/b/isbn/9780201616224-M.jpg' },
    { id: 22, title: 'Zero to One', author: 'Peter Thiel', genre: 'Business', year: 2014, image: 'https://covers.openlibrary.org/b/isbn/9780804139298-M.jpg' },
    { id: 23, title: 'Start With Why', author: 'Simon Sinek', genre: 'Leadership', year: 2009, image: 'https://covers.openlibrary.org/b/isbn/9781591846444-M.jpg' },
    { id: 24, title: 'The Lean Startup', author: 'Eric Ries', genre: 'Startup', year: 2011, image: 'https://covers.openlibrary.org/b/isbn/9780307887894-M.jpg' },
    { id: 25, title: 'Steve Jobs', author: 'Walter Isaacson', genre: 'Biography', year: 2011, image: 'https://covers.openlibrary.org/b/isbn/9781451648539-M.jpg' },
    { id: 26, title: 'Elon Musk', author: 'Ashlee Vance', genre: 'Biography', year: 2015, image: 'https://covers.openlibrary.org/b/isbn/9780062301253-M.jpg' },
    { id: 27, title: 'The Psychology of Money', author: 'Morgan Housel', genre: 'Finance', year: 2020, image: 'https://covers.openlibrary.org/b/isbn/9780062316097-M.jpg' },
    { id: 28, title: 'Ikigai', author: 'Hector Garcia', genre: 'Lifestyle', year: 2016, image: 'https://covers.openlibrary.org/b/isbn/9780143130727-M.jpg' },
    { id: 29, title: "Can't Hurt Me", author: 'David Goggins', genre: 'Motivation', year: 2018, image: 'https://covers.openlibrary.org/b/isbn/9781544512280-M.jpg' },
    { id: 30, title: 'The Subtle Art of Not Giving a F*ck', author: 'Mark Manson', genre: 'Self-help', year: 2016, image: 'https://covers.openlibrary.org/b/isbn/9780062457714-M.jpg' }
  ]
};

async function main() {
  const argv = parseArgs();
  const servicePath = argv.service || process.env.SERVICE_ACCOUNT_FILE;
  const serviceJson = process.env.SERVICE_ACCOUNT_JSON;
  if (!servicePath && !serviceJson) {
    console.error('Provide --service <path> or set SERVICE_ACCOUNT_FILE/SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  let serviceAccount;
  if (serviceJson) {
    try {
      serviceAccount = JSON.parse(serviceJson);
    } catch (e) {
      console.error('Invalid SERVICE_ACCOUNT_JSON');
      process.exit(1);
    }
  } else {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolved = path.resolve(servicePath);
      const raw = fs.readFileSync(resolved, 'utf8');
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      console.error('Could not load service account file:', e.message);
      process.exit(1);
    }
  }

  // load data
  let data = DEFAULT_DATA;
  if (argv.file) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolved = path.resolve(argv.file);
      const raw = fs.readFileSync(resolved, 'utf8');
      data = JSON.parse(raw);
    } catch (e) {
      console.error('Could not load data file:', e.message);
      process.exit(1);
    }
  }

  const adminModule = await import('firebase-admin');
  const admin = adminModule.default || adminModule;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  try {
    const batch = db.batch();
    const col = db.collection('books');
    const now = new Date().toISOString();
    for (const b of data.books) {
      const id = String(b.id);
      const ref = col.doc(id);
      const doc = {
        title: b.title,
        author: b.author,
        category: b.genre || b.category || '',
        description: b.description || '',
        total_copies: b.total_copies || 1,
        available_copies: b.available_copies || (b.total_copies || 1),
        image_url: b.image || b.image_url || null,
        year: b.year || null,
        created_at: now,
        updated_at: now,
      };
      batch.set(ref, doc, { merge: true });
    }
    await batch.commit();
    console.log('Seeded', data.books.length, 'books into Firestore `books` collection.');
  } catch (err) {
    console.error('Error writing to Firestore:', err);
    process.exit(1);
  }
}

main();
