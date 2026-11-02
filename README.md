# Hypotenuse-Squad--Group-5
This will be the repository we'll use for our team project in IS401.

App Summary: 
Young, isolated college students in Provo spend too much time on their phones rather than forming real connections and do not have effective resources to help them develop better habits and find long-term satisfaction. This increased amount of screen time frequently leads them to feeling alone, worsens their mental health, and makes it more difficult to form real-life social support networks during challenging college years. They need to find meaningful ways to spend their free time, especially in the evenings, to avoid doom scrolling. This website should motivate them to have less desire to unintentionally waste time throughout down time each day. They will be able to RSVP to various activities, post your own, communicate with others who are attending events in Provo, learn more about the effects of social media, and create and apply realistic goals or habits. 

ERD:
<img width="1652" height="1277" alt="Momentum_ERD_FInal_page-0001" src="https://github.com/user-attachments/assets/324e5491-9231-4aa4-bef9-58fdee511903" />

Tech Stack:
We decided to use HTML/CSS/JavaScript for our front end. Our hosting service is GitHub and as our back end database service we're using Supabase. We decided to go this route for several reasons. The main reason is because these languages and services are the ones we're most familiar with so it will make editing easier. Beyond that, we want to avoid having to pay for AI services and it's very easy to use up free tokens quickly, but we did use Claude to help put it all together with the resources we gave it. 

How to get it running (starting with a copy of this repo’s code):
1.  Create a Github repo with the code
	-Take these files, and upload them onto a fresh git hub repo.
2.  Create an ERD
	-There is a schema file that you can use to create the supabase tables set up.
Open a new project on supabase
Go to the query tool, and paste in the schema query (found on github → /database/schema). Run the query.
	-If you want to view the ERD on Lucid chart, do the following.
Open a lucid document
Select file → import → ERD → PostgreSQL
Copy the presented query, and run it in a new query back on the supabase project.
Copy the result as a CSV. Return to Lucid chart. Click next, paste all.
Run it, and now you have a field of imported tables.
Place all the loaded tables onto the document, and relationships will form automatically.
3. In the Github repo, you need to connect your supabase.
-Open the config.js on Github’
-Go to the supabase project overview → copy, towards the top.
-Copy ‘Project URL’ → paste it into the congif.js supabase url.
-Copy ‘Publishable key’ → paste it into the config.js supabase anon key
-Save those changes
4. Publish your repo on Github as a page, and voilà!


Verifying the vertical slice:
1. Open the live site link and enter any email and any text as a password. The log in step is not live right now.
2. From the home page, click the “Post an Activity” button
3. Fill in the required information including “Title,” “Activity Type,” “Date,” start and end time and address.
4. Select “Public” under activity visibility
5. Verify the information, then click “Post activity”. Doing this will log the activity in the Supabase “activities” table (request to backend, which grabs data and responds back into frontend).
6. Open the link in a private web browser such as Chrome Incognito and log in. Again, the email and password are meaningless. Do not try to create a real account or use a real username or password.
7. Click on “Activities” and the activity you created should appear on the list! This occurs because the website pulls all the activities from the activities table in Supabase and displays them on screen.






Verifying Vertical Slice 3 (Text Profile Posts with Supabase):
1. Run migration 004 in Supabase:
   - In Supabase → SQL Editor → New query, paste the contents of `database/004_posts.sql` and click Run.
2. Sign in to your account on the site.
3. Navigate to **Profile** (click your avatar in the top-right header).
4. Click the **"Share a post"** button.
5. Notice that the privacy setting is explicitly locked to **"Public (All posts are currently public)"** and photo placeholders indicate **"Photos coming soon. Posts are text-only for now."**
6. Enter text into the **Caption** field describing something you did (e.g., "Finished a 5-mile run at Rock Canyon today!").
7. Click **"Post"**. The post is saved directly into the Supabase `posts` table and appears under "Your posts and activities" with a "Public" badge and a "Delete" option.
8. Open the site in an Incognito / private browsing window (or on another device / account):
   - Check the **Feed** on the Social page (`social.html`) or view the author's profile.
   - The post will appear for everyone because it is stored in and retrieved from Supabase.
9. Test Deletion:
   - On the author's profile, click **"Delete"** on the post and confirm.
   - The post will be deleted from Supabase and will no longer show up anywhere.
