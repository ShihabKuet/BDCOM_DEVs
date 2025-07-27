from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask import abort
from flask_migrate import Migrate
from sqlalchemy import or_, and_
from sqlalchemy.sql import true
from datetime import datetime, timedelta, timezone
from html_diff import diff as html_diff
from threading import Thread
from pystray import Icon, Menu, MenuItem
from PIL import Image, ImageDraw
import os
import webbrowser
import random

app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forum.db'

# PostgreSQL credentials
DB_USERNAME = 'postgres'
DB_PASSWORD = 'bdcom0061'
DB_NAME = 'bdcom_dev_forum'
DB_HOST = 'localhost'
DB_PORT = '5432'
app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app,db)

ADMIN_IP = '192.168.100.133'

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180))
    content = db.Column(db.Text)
    pinned = db.Column(db.Boolean, default=False)
    type = db.Column(db.String(10))  # "Query" or "Patch"
    category = db.Column(db.String(20)) 
    ip_address = db.Column(db.String(45))  # to store IPv4 or IPv6
    last_modified_ip = db.Column(db.String(45)) 
    submitted_by = db.Column(db.String(50))
    last_modified_by = db.Column(db.String(50))
    likes = db.Column(db.Integer, default=0)
    comments = db.relationship('Comment', backref='post', cascade='all, delete-orphan')
    likes_relation = db.relationship('PostLike', backref='post', cascade='all, delete-orphan')
    history_relation = db.relationship('PostHistory', backref='original_post', cascade='all, delete-orphan', passive_deletes=True)
    reference_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    reference = db.relationship('Post', remote_side=[id], backref='patches')
    notifications = db.relationship('Notification', backref='post', passive_deletes=True)
    featured = db.relationship('FeaturedPost', backref='feat_post', cascade='all, delete-orphan', passive_deletes=True)
    followers = db.relationship('PostFollow', backref='followed_post', cascade='all, delete-orphan', passive_deletes=True)
    is_visible = db.Column(db.Boolean, default=True)

def dhaka_time():
    return datetime.now() + timedelta(hours=6)

class PostHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.Text)
    content = db.Column(db.Text)
    type = db.Column(db.String(10))
    category = db.Column(db.String(20))
    edited_at = db.Column(db.DateTime, default=dhaka_time)
    edited_by = db.Column(db.String(50))
    edited_by_ip = db.Column(db.String(45))

class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    db.UniqueConstraint('post_id', 'ip_address', name='unique_post_ip')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=dhaka_time)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)

class Notice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=dhaka_time)

class UserIP(db.Model):
    __tablename__ = 'user_ip'
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_ip = db.Column(db.String(45), nullable=False)  # Receiver's IP
    message = db.Column(db.Text, nullable=False)
    related_post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='SET NULL'), nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=dhaka_time)
    
class FeaturedPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    link = db.Column(db.String(255), nullable=False)
    added_at = db.Column(db.DateTime, default=dhaka_time)
    
class PostFollow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=False)
    follower_ip = db.Column(db.String(45), nullable=False)
    __table_args__ = (db.UniqueConstraint('post_id', 'follower_ip', name='unique_post_follow'),)

class Tip(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tip_message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=dhaka_time)

# Discussion
class Discussion(db.Model):
    __tablename__ = 'discussion'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    created_by_ip = db.Column(db.String(45), nullable=False)
    created_by_name = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=dhaka_time)  # your tz helper
    status = db.Column(db.String(20), default="Active")  # Active, Closed, Archived
    is_closed = db.Column(db.Boolean, default=False)
    closed_by_ip = db.Column(db.String(45))
    closed_by_name = db.Column(db.String(80))
    closed_at = db.Column(db.DateTime)

    messages = db.relationship(
        'DiscussionMessage',
        backref='discussion',
        cascade='all, delete-orphan',
        order_by='DiscussionMessage.created_at.asc()'
    )


class DiscussionMessage(db.Model):
    __tablename__ = 'discussion_message'

    id = db.Column(db.Integer, primary_key=True)
    discussion_id = db.Column(
        db.Integer, db.ForeignKey('discussion.id', ondelete='CASCADE'),
        nullable=False
    )
    content = db.Column(db.Text, nullable=False)
    author_ip = db.Column(db.String(45), nullable=False)
    author_name = db.Column(db.String(80))  # optional from your UserIP table
    created_at = db.Column(db.DateTime, default=dhaka_time)

# Discussion feature ends

def load_app_version():
    with open('version') as f:
        for line in f:
            if line.startswith('APP_VERSION'):
                return line.strip().split('=')[1]
    return "0.0.0"

APP_VERSION = load_app_version()

# Create a small icon (or load your own)
def create_image():
    img = Image.new('RGB', (64, 64), color='blue')
    d = ImageDraw.Draw(img)
    d.text((10, 20), "BDF", fill="white")
    return img

@app.route('/user')
def user_profile():
    current_ip = request.remote_addr
    user = UserIP.query.filter_by(ip_address=current_ip).first()
    user_posts = (
        Post.query
        .filter_by(submitted_by=user.username if user else None, is_visible=True)
        .order_by(Post.id.desc())  # Sort by highest ID first
        .all()
    )
    followed_posts = (
        db.session.query(Post)
        .join(PostFollow, Post.id == PostFollow.post_id)
        .filter(PostFollow.follower_ip == current_ip)
        .all()
    )
    return render_template(
        'user_profile.html',
        user=user,
        user_posts=user_posts,
        followed_posts=followed_posts,
        current_ip=current_ip
    )

# Utility function to create notifications
def create_notification(user_ip, message, related_post_id=None):
    notification = Notification(user_ip=user_ip, message=message, related_post_id=related_post_id)
    db.session.add(notification)
    db.session.commit()

@app.route('/notifications')
def get_notifications():
    ip = request.remote_addr
    notifications = Notification.query.filter_by(user_ip=ip).order_by(Notification.timestamp.desc()).all()
    return jsonify([{
        'id': n.id,
        'message': n.message,
        'related_post_id': n.related_post_id,
        'is_read': n.is_read,
        'timestamp': n.timestamp.strftime('%Y-%m-%d %H:%M')
    } for n in notifications])

@app.route('/notifications/mark_all_read', methods=['POST'])
def mark_all_read():
    ip = request.remote_addr
    Notification.query.filter_by(user_ip=ip, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All marked as read'})

@app.route('/notifications/clear', methods=['DELETE'])
def clear_notifications():
    ip = request.remote_addr
    Notification.query.filter_by(user_ip=ip).delete()
    db.session.commit()
    return jsonify({'message': 'Notifications cleared'})

@app.route('/notifications/<int:notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    ip = request.remote_addr
    notification = Notification.query.filter_by(id=notification_id, user_ip=ip).first()
    if notification:
        db.session.delete(notification)
        db.session.commit()
        return jsonify({'message': 'Notification deleted'}), 200
    return jsonify({'error': 'Not found'}), 404

@app.route('/all_notifications')
def all_notifications():
    ip = request.remote_addr
    notifications = Notification.query.filter_by(user_ip=ip).order_by(Notification.timestamp.desc()).all()
    return render_template('all_notifications.html', notifications=notifications)

@app.route('/api/featured_posts')
def get_featured_posts():
    featured = FeaturedPost.query.order_by(FeaturedPost.added_at.desc()).limit(2).all()
    return jsonify([
        {'id': f.id, "title": f.title, "link": f.link}
        for f in featured
    ])
    
@app.route('/api/all_posts')
def get_all_posts():
    posts = Post.query.order_by(Post.id.desc()).all()
    return jsonify([{"id": p.id, "title": p.title} for p in posts])

@app.route('/notices')
def get_notices():
    notices = Notice.query.order_by(Notice.created_at.desc()).limit(5).all()
    return jsonify([{'id': n.id, 'content': n.content} for n in notices])

@app.route('/notices', methods=['POST'])
def add_notice():
    if not is_admin():  # If you have an `is_admin()` check
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    content = data.get('content')
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    notice = Notice(content=content)
    db.session.add(notice)
    db.session.commit()
    return jsonify({'message': 'Notice posted successfully'}), 201

@app.route('/notices/<int:notice_id>', methods=['PUT'])
def edit_notice(notice_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    notice = Notice.query.get_or_404(notice_id)
    notice.content = content
    db.session.commit()
    return jsonify({'message': 'Notice updated successfully'}), 200

@app.route('/notices/<int:notice_id>', methods=['DELETE'])
def delete_notice(notice_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403

    notice = Notice.query.get_or_404(notice_id)
    db.session.delete(notice)
    db.session.commit()
    return jsonify({'message': 'Notice deleted successfully'}), 200


@app.route('/admin/notice')
def notice_admin():
    if request.remote_addr != ADMIN_IP:
        abort(403)  # Forbidden
    return render_template('admin_notice.html')

@app.route('/bdf_manual')
def manual():
    return render_template('bdf_manual.html')

def is_admin():
    return request.remote_addr == ADMIN_IP

@app.context_processor
def inject_year():
    return {
        'current_year': datetime.now().year,
        'app_version': APP_VERSION
    }

@app.route('/')
def index():
    active_discussions_count = Discussion.query.filter_by(status='Active').count()
    return render_template("index.html", active_discussions_count=active_discussions_count)

@app.route('/my-ip')
def get_my_ip():
    return jsonify({'ip': request.remote_addr})

@app.route('/confirm_register_ip', methods=['POST'])
def confirm_register_ip():
    data = request.get_json()
    ip_address = data.get('ip_address')

    if not ip_address:
        return jsonify({'error': 'IP address is required'}), 400

    existing = UserIP.query.filter_by(ip_address=ip_address).first()
    if existing:
        return jsonify({
            'exists': True,
            'current_username': existing.username
        }), 200
    else:
        return jsonify({'exists': False}), 200


@app.route('/register_ip', methods=['GET', 'POST'])
def register_ip():
    if request.method == 'POST':
        data = request.get_json()
        ip_address = data.get('ip_address')
        username = data.get('username')

        if not ip_address or not username:
            return jsonify({'error': 'Both fields are required'}), 400

        # Check if IP exists already
        existing = UserIP.query.filter_by(ip_address=ip_address).first()
        if existing:
            existing.username = username  # update existing
        else:
            new_entry = UserIP(ip_address=ip_address, username=username)
            db.session.add(new_entry)

        db.session.commit()
    
        # Send notification to the user of this IP address
        message = (
            f"👤 Username of this ip address ({ip_address}) has been changed to <strong>{username}</strong>"
        )
        create_notification(ip_address, message, None)
            
        return jsonify({'message': 'IP registered successfully'}), 201

    return render_template('register_ip.html')

@app.route('/api/user_ips')
def get_user_ips():
    all_users = UserIP.query.order_by(UserIP.id.desc()).all()
    return jsonify([
        {'ip': u.ip_address, 'username': u.username} for u in all_users
    ])
    
@app.route('/follow/<int:post_id>', methods=['POST'])
def toggle_follow(post_id):
    post = Post.query.get_or_404(post_id)
    user_ip = request.remote_addr

    existing = PostFollow.query.filter_by(post_id=post_id, follower_ip=user_ip).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'followed': False}), 200
    else:
        new_follow = PostFollow(post_id=post_id, follower_ip=user_ip)
        db.session.add(new_follow)
        db.session.commit()
        return jsonify({'followed': True}), 201


@app.route('/posts', methods=['GET', 'POST'])
def posts():
    if request.method == 'POST':
        data = request.json
        ip = request.remote_addr
        reference_id = data.get('reference_id')
        submitted_by = data.get('submitted_by', ip)  # fallback to IP if username not provided
        last_modified_by = data.get('last_modified_by', ip)  # fallback to IP if username not provided

        new_post = Post(
            title=data['title'],
            content=data['content'],
            type=data['type'],
            category=data['category'],
            ip_address=ip,
            last_modified_ip=ip,
            submitted_by=submitted_by,
            last_modified_by=last_modified_by,
            reference_id=reference_id
        )
        db.session.add(new_post)
        db.session.commit()

        # Save history before changing
        history = PostHistory(
            post_id=new_post.id,
            title=new_post.title,
            content=new_post.content,
            type=new_post.type,
            category=new_post.category,
            edited_by=new_post.last_modified_by,
            edited_by_ip=new_post.last_modified_ip
        )
        db.session.add(history)
        db.session.commit()

        if reference_id:
            followers = PostFollow.query.filter_by(post_id=reference_id).all()

            ref_post = Post.query.get(reference_id)
            for follower in followers:
                if follower.follower_ip != request.remote_addr:
                    message = (
                        f"🔗 A new post <strong>{new_post.title}</strong> references a post you follow "
                        f"(<strong>{ref_post.title}</strong>)."
                    )
                    create_notification(follower.follower_ip, message, new_post.id)

        return jsonify({'message': 'Post added successfully'}), 201
    else:
        # Pagination parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        #
        user_ip = request.remote_addr
        #all_posts = Post.query.order_by(Post.id.desc()).all()
        paginated_posts = Post.query.filter_by(is_visible=True)\
            .order_by(Post.pinned.desc(), Post.id.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'posts': [{
                'id': post.id,
                'title': post.title,
                'content': post.content,
                'type': post.type,
                'ip_address': post.ip_address,
                'category': post.category,
                'last_modified_ip': post.last_modified_ip,
                'pinned': post.pinned,
                'likes': post.likes,
                'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
            } for post in paginated_posts.items],
            'has_next': paginated_posts.has_next,
            'has_prev': paginated_posts.has_prev,
            'page': paginated_posts.page,
            'total_pages': paginated_posts.pages
        })
    
@app.route('/posts/summary')
def post_summaries():
    posts = Post.query.order_by(Post.id.desc()).all()
    return jsonify([
        {'id': post.id, 'title': post.title, 'type': post.type}
        for post in posts
    ])

@app.route('/create', methods=['GET'])
def create_post_page():
    user_ip = request.remote_addr
    known_user = db.session.query(UserIP).filter_by(ip_address=user_ip).first()
    return render_template('create_post.html', known_user=known_user.username if known_user else None)

@app.route('/search')
def search():
    query = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip().lower()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    user_ip = request.remote_addr

    filters = [Post.is_visible == True]

    # Add search query filter if present
    if query:
        filters.append(or_(
            Post.title.ilike(f'%{query}%'),
            Post.content.ilike(f'%{query}%')
        ))

    # Add category filter if present
    if category:
        filters.append(Post.category.ilike(category))  # case-insensitive match

    filtered_query = Post.query.filter(and_(*filters)).order_by(Post.pinned.desc(), Post.id.desc())
    paginated_posts = filtered_query.paginate(page=page, per_page=per_page, error_out=False)

    # Combine all filters with AND
    #posts = Post.query.filter(and_(*filters)).order_by(Post.id.desc()).all()

    return jsonify({
        'posts': [{
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'type': post.type,
            'ip_address': post.ip_address,
            'category': post.category,
            'last_modified_ip': post.last_modified_ip,
            'submitted_by': post.submitted_by,
            'last_modified_by': post.last_modified_by,
            'pinned': post.pinned,
            'likes': post.likes,
            'liked': PostLike.query.filter_by(post_id=post.id, ip_address=user_ip).first() is not None
        } for post in paginated_posts.items],
        'has_next': paginated_posts.has_next,
        'has_prev': paginated_posts.has_prev,
        'page': paginated_posts.page,
        'total_pages': paginated_posts.pages
    })

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    requester_ip = request.remote_addr

    if requester_ip == post.ip_address or requester_ip == ADMIN_IP:
        db.session.delete(post)
        db.session.commit()
        return jsonify({'message': 'Post deleted successfully'}), 200
    else:
        return jsonify({'error': 'Unauthorized to delete this post'}), 403

@app.route('/posts/<int:post_id>/soft_delete', methods=['PATCH'])
def soft_delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.is_visible = False
    db.session.commit()

    # Send notification to user containing post.id after soft delete 
    message = (
        f"🗑️ Your post <strong>{post.title}</strong> has been deleted. Remember POST ID: <strong>{post_id}</strong> in order to request recover."
    )
    create_notification(post.ip_address, message, None)

    return jsonify({'message': 'Post soft-deleted'}), 200

@app.route('/posts/<int:post_id>/recover', methods=['PATCH'])
def recover_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.is_visible = True
    db.session.commit()

    # Send notification to user containing post.id after recover 
    message = (
        f"🗑️ Your post <strong>{post.title}</strong> (POST ID: <strong>{post_id}</strong>) has been recovered"
    )
    create_notification(post.ip_address, message, post.id)

    return jsonify({'message': 'Post recovered'}), 200

@app.route('/admin/deleted_posts')
def view_deleted_posts():
    deleted_posts = Post.query.filter_by(is_visible=False).order_by(Post.id.desc()).all()
    return render_template('admin_deleted_posts.html', posts=deleted_posts)

@app.route('/posts/<int:post_id>')
def get_post(post_id):
    post = Post.query.get_or_404(post_id)
    history_count = PostHistory.query.filter_by(post_id=post.id).count() # To render 'see edit history' or not
    current_ip = request.remote_addr  # Get current user's IP
    known_user = db.session.query(UserIP).filter_by(ip_address=current_ip).first()
    is_following = PostFollow.query.filter_by(post_id=post.id, follower_ip=request.remote_addr).first() is not None
    return render_template('post.html', post=post, current_ip=current_ip, admin_ip=ADMIN_IP, history_count=history_count, is_following=is_following, known_user=known_user.username if known_user else None)

@app.route("/similar-posts/<int:post_id>")
def get_similar_posts(post_id):
    original = Post.query.get_or_404(post_id)
    limit_no = 3 # max number of similar posts to return

    # Get a meaningful keyword from title and content (fallback if empty)
    title_keyword = original.title.split()[0] if original.title else ""
    content_keyword = original.content.split()[0] if original.content else ""

    similar = Post.query.filter(
        Post.id != post_id,
        Post.is_visible.is_(True),
        or_(
            Post.title.ilike(f"%{title_keyword}%"),
            Post.category == original.category,
            Post.content.ilike(f"%{content_keyword}%")
        )
    ).order_by(Post.id.desc()).limit(limit_no).all()  # 👈 LIMIT to limit_no

    return jsonify([
        {"id": p.id, "title": p.title, "submitted_by": p.submitted_by}
        for p in similar
    ])

def apply_yellow_highlight(diff_text):
    return (diff_text
        .replace('<ins>', '<ins style="background-color: yellow;">')
        .replace('<del>', '<del style="background-color: #ffeeba; text-decoration: line-through;">'))

def save_post_history_async(post_id, old_title, old_content, new_title, new_content, new_type, new_category, edited_by, edited_by_ip):
    with app.app_context():            # ✅ this is required in threads: ensures db.session and current_app are bound properly.
        raw_title_diff = html_diff(old_title or "", new_title or "")
        raw_content_diff = html_diff(old_content or "", new_content or "")

        highlighted_title = apply_yellow_highlight(raw_title_diff)
        highlighted_content = apply_yellow_highlight(raw_content_diff)

        history = PostHistory(
            post_id=post_id,
            title=highlighted_title,
            content=highlighted_content,
            type=new_type,
            category=new_category,
            edited_by=edited_by,
            edited_by_ip=edited_by_ip
        )
        db.session.add(history)
        db.session.commit()

@app.route('/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.json

    # Extract new values from request
    new_title = data.get('title', post.title)
    new_content = data.get('content', post.content)
    new_type=data.get('type', post.type)
    new_category=data.get('category', post.category)

    # Use html_diff to get basic <ins>/<del> diff
    # raw_title_diff = html_diff(post.title or "", new_title or "")
    # raw_content_diff = html_diff(post.content or "", new_content or "")

    # highlighted_title = apply_yellow_highlight(raw_title_diff)
    # highlighted_content = apply_yellow_highlight(raw_content_diff)

    # Check if any field has changed
    if (
        new_title == post.title and
        new_content == post.content and
        new_type == post.type and
        new_category == post.category
    ):
        return jsonify({'message': 'Nothing is modified'}), 200

    # Save history before changing
    # history = PostHistory(
    #     post_id=post.id,
    #     title=highlighted_title,
    #     content=highlighted_content,
    #     type=new_type,
    #     category=new_category,
    #     edited_by=data.get('last_modified_by', post.last_modified_by),
    #     edited_by_ip=request.remote_addr
    # )
    # db.session.add(history)
    editor = data.get('last_modified_by', post.last_modified_by)
    editor_ip = request.remote_addr

    old_title = post.title # keep old title for notification
    old_content = post.content

    Thread(target=save_post_history_async, args=(
        post.id, old_title, old_content,
        new_title, new_content, new_type, new_category,
        editor, editor_ip
    )).start() 
    
    # Apply updates
    post.title = new_title
    post.content = new_content
    post.type = new_type
    post.category = new_category
    post.last_modified_by = data.get('last_modified_by', post.last_modified_by)
    post.last_modified_ip = request.remote_addr

    db.session.commit()

    # Send notification after edit 
    if post.last_modified_ip != post.ip_address:
        message = (
            f"✏️ Your post <strong>{old_title}</strong> has been modified by <strong>{post.last_modified_by}</strong>"
        )
        create_notification(post.ip_address, message, post.id)

    # Notify all followers except who edited
    followers = PostFollow.query.filter(
        PostFollow.post_id == post.id,
        PostFollow.follower_ip != post.last_modified_ip
    ).all()

    for follower in followers:
        message = f"🔔 A post you follow (<strong>{old_title}</strong>) has beed modified by <strong>{post.last_modified_by}</strong>"
        create_notification(follower.follower_ip, message, post.id)

    return jsonify({'message': 'Post updated successfully'}), 200

@app.route('/posts/<int:post_id>/history')
def post_history(post_id):
    post = Post.query.get_or_404(post_id)
    history = PostHistory.query.filter_by(post_id=post.id).order_by(PostHistory.edited_at.desc()).all()

    history_data = []
    for h in history:
        user = UserIP.query.filter_by(ip_address=h.edited_by_ip).first()
        history_data.append({
            'title': h.title,
            'content': h.content,
            'type': h.type,
            'category': h.category,
            'edited_at': h.edited_at.strftime('%Y-%m-%d %H:%M'),
            'edited_by': h.edited_by if h.edited_by else h.edited_by_ip
        })

    return jsonify(history_data)


@app.route('/like/<int:post_id>', methods=['POST'])
def toggle_like(post_id):
    post = Post.query.get_or_404(post_id)
    user_ip = request.remote_addr

    existing_like = PostLike.query.filter_by(post_id=post_id, ip_address=user_ip).first()

    if existing_like:
        # Unlike: remove the record and decrement likes
        db.session.delete(existing_like)
        post.likes = max(post.likes - 1, 0)
        db.session.commit()
        return jsonify({'likes': post.likes, 'liked': False}), 200
    else:
        # Like: add record and increment likes
        new_like = PostLike(post_id=post_id, ip_address=user_ip)
        db.session.add(new_like)
        post.likes += 1
        db.session.commit()

        # Lookup liker username from UserIP table
        liker_user = UserIP.query.filter_by(ip_address=user_ip).first()
        liker_name = liker_user.username if liker_user else user_ip or "Someone"

        # Count how many others liked this post (excluding current liker)
        other_likes_count = PostLike.query.filter(
            PostLike.post_id == post_id,
            PostLike.ip_address != user_ip
        ).count()
        others_text = f" &amp; {other_likes_count} others" if other_likes_count > 0 else ""

        # Send notification if liker is not the post owner
        if user_ip != post.ip_address:
            message = (
                f"🌟 Your post <strong>{post.title}</strong> got a new appreciation by "
                f"<strong>{liker_name}</strong>{others_text}."
            )
            create_notification(post.ip_address, message, post.id)

        return jsonify({'likes': post.likes, 'liked': True}), 201

@app.route('/comments/<int:post_id>', methods=['GET'])
def get_comments(post_id):
    comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.timestamp.asc()).all()
    response = []

    for comment in comments:
        commenter = UserIP.query.filter_by(ip_address=comment.ip_address).first()
        if commenter:
            commented_by = commenter.username or commenter.ip_address
        else:
            commented_by = "Unknown"
        response.append({
            'id': comment.id,
            'content': comment.content,
            'ip_address': comment.ip_address,
            'commented_by': commented_by,
            'timestamp': comment.timestamp.strftime('%Y-%m-%d %H:%M')
        })
    return jsonify(response)

@app.route('/comments/<int:post_id>', methods=['POST'])
def add_comment(post_id):
    data = request.get_json()
    content = data.get('content')
    user_ip = request.remote_addr
    post = Post.query.get_or_404(post_id)

    comment = Comment(post_id=post_id, content=content, ip_address=user_ip)
    db.session.add(comment)
    db.session.commit()

    # Lookup commenter username from UserIP table
    commenter = UserIP.query.filter_by(ip_address=user_ip).first()
    commenter_name = commenter.username if commenter else user_ip or "Someone"

    # Send notification if commenter is not the post owner
    if user_ip != post.ip_address:
        message = (
            f"💬 <strong>{commenter_name}</strong> gave feedback on your post <strong>{post.title}</strong>"
        )
        create_notification(post.ip_address, message, post.id)
        
    # Notify all followers except who commented
    followers = PostFollow.query.filter(
        PostFollow.post_id == post.id,
        PostFollow.follower_ip != user_ip
    ).all()

    for follower in followers:
        message = f"🔔 A post you follow (<strong>{post.title}</strong>) has got a feedback"
        create_notification(follower.follower_ip, message, post.id)

    return jsonify({'message': 'Comment added successfully'}), 201

@app.route('/comments/<int:comment_id>', methods=['PUT'])
def edit_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    if comment.ip_address != request.remote_addr:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    comment.content = data.get('content', comment.content)
    db.session.commit()

    return jsonify({'message': 'Comment updated successfully'})

@app.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    if comment.ip_address != request.remote_addr:
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify({'message': 'Comment deleted successfully'})

#only for admin
@app.route('/admin/dashboard')
def admin_dashboard():
    if not is_admin():
        return abort(403)

    total_posts = Post.query.count()
    total_comments = Comment.query.count()
    total_users = UserIP.query.count()
    total_notices = Notice.query.count()
    total_invisible_posts = Post.query.filter_by(is_visible=False).count()

    return render_template('admin_dashboard.html',
                           total_posts=total_posts,
                           total_comments=total_comments,
                           total_users=total_users,
                           total_notices=total_notices,
                           total_invisible_posts=total_invisible_posts)

@app.route('/admin/posts')
def admin_posts():
    if request.remote_addr != ADMIN_IP:
        abort(403)  # Forbidden

    posts = Post.query.order_by(Post.id.desc()).all()
    return render_template('admin_posts.html', posts=posts)

@app.route('/posts/<int:post_id>', methods=['PUT', 'DELETE'])
def update_or_delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    user_ip = request.remote_addr

    if request.method == 'DELETE':
        if user_ip != post.ip_address and user_ip != '127.0.0.1':
            return jsonify({'error': 'Unauthorized'}), 403
        db.session.delete(post)
        db.session.commit()
        return jsonify({'message': 'Deleted'}), 200

    elif request.method == 'PUT':
        data = request.json
        if user_ip != post.ip_address and user_ip != '127.0.0.1':
            return jsonify({'error': 'Unauthorized'}), 403

        if 'title' in data:
            post.title = data['title']
        if 'category' in data:
            post.category = data['category']
        if 'type' in data:
            post.type = data['type']
        if 'content' in data:
            post.content = data['content']

        post.last_modified_ip = user_ip
        db.session.commit()
        return jsonify({'message': 'Updated'}), 200
    
@app.route('/admin/featured_posts', methods=['POST'])
def add_featured_post():
    # if request.remote_addr != ADMIN_IP:
    #     return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    post_id = data.get('post_id')
    title = data.get('title')
    link = data.get('link')

    # Check if already exists
    existing = FeaturedPost.query.filter_by(post_id=post_id).first()
    if existing:
        return jsonify({'message': 'Already featured'}), 200

    featured = FeaturedPost(post_id=post_id, title=title, link=link)
    db.session.add(featured)
    db.session.commit()

    return jsonify({'message': 'Featured post added'}), 201


@app.route('/admin/featured_posts/<int:fid>', methods=['DELETE'])
def delete_featured_post(fid):
    # if request.remote_addr != ADMIN_IP:
    #     return jsonify({'error': 'Unauthorized'}), 403
    
    featured = FeaturedPost.query.get_or_404(fid)
    db.session.delete(featured)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

@app.route('/posts/<int:post_id>/pin', methods=['POST'])
def pin_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.pinned = True
    db.session.commit()
    return jsonify({'message': 'Post pinned'})

@app.route('/posts/<int:post_id>/unpin', methods=['POST'])
def unpin_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.pinned = False
    db.session.commit()
    return jsonify({'message': 'Post unpinned'})

@app.route('/admin/manage_featured')
def admin_manage_featured():
    if not is_admin():
        abort(403)
    return render_template('admin_featured.html')

#only for admin ends

@app.route('/admin/tips', methods=['GET', 'POST'])
def manage_tips():
    if request.method == 'POST':
        tip_msg = request.form.get('tip')
        if tip_msg:
            new_tip = Tip(tip_message=tip_msg)
            db.session.add(new_tip)
            db.session.commit()
    tips = Tip.query.order_by(Tip.id.desc()).all()
    return render_template('admin_tips.html', tips=tips)


@app.route('/admin/tips/delete/<int:tip_id>', methods=['POST'])
def delete_tip(tip_id):
    tip = Tip.query.get_or_404(tip_id)
    db.session.delete(tip)
    db.session.commit()
    return redirect(url_for('manage_tips'))


@app.route('/daily_tip')
def daily_tip():
    tips = Tip.query.all()
    if not tips:
        return jsonify({"tip": "Stay motivated! 🚀"})
    
    # Deterministically rotate tip per day using day of year
    index = datetime.now().timetuple().tm_yday % len(tips)
    return jsonify({"tip": tips[index].tip_message})

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/why_bdf')
def why_bdf():
    return render_template('why_bdf.html')

# Discussion
@app.route('/discussions', methods=['GET'])
def list_discussions():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))

    qs = Discussion.query.filter(Discussion.status != 'Archived').order_by(Discussion.is_closed.desc(), Discussion.created_at.desc())
    paginated = qs.paginate(page=page, per_page=per_page, error_out=False)

    # HTML page
    if request.accept_mimetypes.accept_html:
        return render_template('discussions/index.html', discussions=paginated.items,
                               page=paginated.page, total_pages=paginated.pages)

    # JSON
    return jsonify({
        'items': [{
            'id': d.id,
            'title': d.title,
            'is_closed': d.is_closed,
            'created_by_name': d.created_by_name,
            'created_at': d.created_at.isoformat()
        } for d in paginated.items],
        'page': paginated.page,
        'total_pages': paginated.pages
    })

@app.route('/discussions/new', methods=['GET', 'POST'])
def create_discussion():
    if request.method == 'GET':
        current_ip = request.remote_addr
        known_user = UserIP.query.filter_by(ip_address=current_ip).first()
        return render_template('discussions/new.html',
                               known_user=known_user.username if known_user else None)

    data = request.get_json() or request.form
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title required'}), 400

    ip = request.remote_addr
    known_user = UserIP.query.filter_by(ip_address=ip).first()

    d = Discussion(
        title=title,
        created_by_ip=ip,
        created_by_name=known_user.username if known_user else ip
    )
    db.session.add(d)
    db.session.commit()

    return jsonify({'message': 'Discussion created', 'id': d.id}), 201

@app.route('/discussions/<int:discussion_id>', methods=['GET'])
def view_discussion(discussion_id):
    d = Discussion.query.get_or_404(discussion_id)
    current_ip = request.remote_addr
    known_user = UserIP.query.filter_by(ip_address=current_ip).first()

    return render_template('discussions/show.html',
                           discussion=d,
                           is_admin=(current_ip == ADMIN_IP or current_ip == d.created_by_ip),
                           known_user=known_user.username if known_user else None)

@app.route('/discussions/<int:discussion_id>/status', methods=['PATCH'])
def update_discussion_status(discussion_id):
    discussion = Discussion.query.get_or_404(discussion_id)
    current_ip = request.remote_addr

    # Only admin or creator can modify
    if current_ip != ADMIN_IP and current_ip != discussion.created_by_ip:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.json
    new_status = data.get('status')

    # Ensure Archived cannot be reactivated
    if discussion.status == "Archived" and new_status != "Archived":
        return jsonify({'error': 'Archived discussions cannot be reactivated'}), 400

    # Validate status
    if new_status not in ["Active", "Closed", "Archived"]:
        return jsonify({'error': 'Invalid status'}), 400

    discussion.status = new_status
    db.session.commit()
    return jsonify({'message': f'Discussion status updated to {new_status}'}), 200


@app.route('/discussions/<int:discussion_id>', methods=['DELETE'])
def delete_discussion(discussion_id):
    discussion = Discussion.query.get_or_404(discussion_id)
    current_ip = request.remote_addr

    # Only creator or admin can delete
    if not (is_admin() or discussion.created_by_ip == current_ip):
        return jsonify({'error': 'Unauthorized'}), 403

    # First delete related messages
    DiscussionMessage.query.filter_by(discussion_id=discussion_id).delete()

    db.session.delete(discussion)
    db.session.commit()
    return jsonify({'message': 'Discussion deleted successfully'}), 200


@app.route('/discussions/<int:discussion_id>/messages', methods=['GET'])
def fetch_messages(discussion_id):
    d = Discussion.query.get_or_404(discussion_id)
    msgs = DiscussionMessage.query.filter_by(discussion_id=discussion_id)\
                                  .order_by(DiscussionMessage.created_at.asc()).all()

    return jsonify([{
        'id': m.id,
        'content': m.content,
        'author_name': m.author_name or m.author_ip,
        'created_at': m.created_at.strftime('%Y-%m-%d %H:%M')
    } for m in msgs])

@app.route('/discussions/<int:discussion_id>/messages', methods=['POST'])
def post_message(discussion_id):
    d = Discussion.query.get_or_404(discussion_id)
    if d.is_closed:
        return jsonify({'error': 'Discussion is closed'}), 403

    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Message cannot be empty'}), 400

    ip = request.remote_addr
    known_user = UserIP.query.filter_by(ip_address=ip).first()

    msg = DiscussionMessage(
        discussion_id=discussion_id,
        content=content,
        author_ip=ip,
        author_name=known_user.username if known_user else None
    )

    db.session.add(msg)
    db.session.commit()

    # Optional: notify discussion creator or future “followers” here

    return jsonify({'message': 'Message posted'}), 201

@app.route('/discussions/<int:discussion_id>/close', methods=['POST'])
def close_discussion(discussion_id):
    d = Discussion.query.get_or_404(discussion_id)
    ip = request.remote_addr
    known_user = UserIP.query.filter_by(ip_address=ip).first()

    if ip != ADMIN_IP and ip != d.created_by_ip:
        abort(403)

    d.is_closed = True
    d.closed_by_ip = ip
    d.closed_by_name = known_user.username if known_user else ip
    d.closed_at = dhaka_time()
    db.session.commit()

    return jsonify({'message': 'Discussion closed'})

@app.route('/discussions/<int:discussion_id>/reopen', methods=['POST'])
def reopen_discussion(discussion_id):
    d = Discussion.query.get_or_404(discussion_id)
    ip = request.remote_addr
    if ip != ADMIN_IP and ip != d.created_by_ip:
        abort(403)

    d.is_closed = False
    d.closed_by_ip = None
    d.closed_by_name = None
    d.closed_at = None
    db.session.commit()

    return jsonify({'message': 'Discussion reopened'})

@app.route('/archived-discussions', defaults={'page': 1})
@app.route('/archived-discussions/page/<int:page>')
def archived_discussions(page):
    per_page = 10  # Number of discussions per page
    total_archived = Discussion.query.filter_by(status='Archived').count()
    total_pages = (total_archived + per_page - 1) // per_page
    
    discussions = (Discussion.query.filter_by(status='Archived')
                   .order_by(Discussion.created_at.desc())
                   .offset((page - 1) * per_page)
                   .limit(per_page)
                   .all())

    return render_template(
        'discussions/archived.html',
        discussions=discussions,
        page=page,
        total_pages=total_pages
    )


#end discussion

# Tray menu actions
def open_browser(icon, item):
    webbrowser.open("http://localhost:5005")

def exit_app(icon, item):
    icon.stop()
    os._exit(0)  # force quit all threads

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5005, debug=True)

