tell application "Reminders"
	set theList to list "GRFT+"

	-- Create the New Website section
	set newSection to make new section at theList with properties {name:"New Website"}

	-- Add the tasks
	make new reminder at theList with properties {name:"Push all changes to GitHub (git add -A && git commit && git push)", section:newSection}
	make new reminder at theList with properties {name:"Sign up at Formspree.io and replace YOUR_FORM_ID in all contact forms", section:newSection}
	make new reminder at theList with properties {name:"Convert hero video to WebM — run ffmpeg command in Terminal", section:newSection}
	make new reminder at theList with properties {name:"Add real photos/videos to timeline card placeholders", section:newSection}
	make new reminder at theList with properties {name:"Add 90s book title to timeline founder section", section:newSection}
end tell
