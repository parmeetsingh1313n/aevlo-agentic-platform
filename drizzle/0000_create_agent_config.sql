CREATE TABLE "agentConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(36) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text,
	"agentImage" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"userEmail" text NOT NULL,
	CONSTRAINT "agentConfig_agentId_unique" UNIQUE("agentId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"credits" integer DEFAULT 5 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agentConfig" ADD CONSTRAINT "agentConfig_userEmail_users_email_fk" FOREIGN KEY ("userEmail") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;