var EDITOR          = "editor";
var REVIEW_COMMENTS = new Map();
var CUR_COMM_ELMT   = null;
var CUR_REVIEWER    = "";
var REV_UUID        = "";
var REV_COMM_LIST   = document.getElementById("review_list");
const URL_REGEX     = new RegExp('^(https?)(://)([^/:]+)(:[0-9]{1,5})?(/.*)?$');
var MODELIST        = ace.require("ace/ext/modelist");

// Comm' with backend

function upload_file(e) {
    e.preventDefault();
    var file_obj = e.dataTransfer.files[0];
    if (file_obj != undefined) {
        var form_data = new FormData();                  
        form_data.append('file', file_obj);
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "reviews", true);
        xhttp.onload = function() {
            if (xhttp.status == 200) {
                // Update current URL then reload
                revUuid = this.responseText;
                window.history.pushState("", "", "?review_uuid=" + revUuid);
                document.location.href = document.URL;
            } else {
                alert("Error " + xhttp.status + " occurred when trying to upload your file.");
            }
        }
 
        xhttp.send(form_data);
    }
}

function post_review_comment(review_comment) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "reviews/"+REV_UUID+"/comments", true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.onreadystatechange = function() {
        if(xhttp.readyState == 4 && xhttp.status == 200) {
            var new_review_comment = JSON.parse(xhttp.responseText);
            review_comment.id = new_review_comment.id;
            _createReview(review_comment);
            // console.log("console.log(review_comment);");
            // console.log(review_comment);
        }
    }
    xhttp.send(JSON.stringify(review_comment));
}

function delete_review_comment_by_id(review_comment_id) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("DELETE", "reviews/"+REV_UUID+"/comments/"+review_comment_id, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send();
}

// ReviewComment class

class ReviewComment
{
    constructor(_reviewer, _fromrow, _fromcol, _torow, _tocol, _comment, _id = undefined)
    {
        this.id = _id;
        this.reviewer = _reviewer;
        this.fromrow  = _fromrow;
        this.fromcol  = _fromcol;
        this.torow    = _torow;
        this.tocol    = _tocol;
        this.comment  = _comment;
    }

    toString()
    {
        return `${this.reviewer} --> ${this.comment}`;
    }
};

function init_JS_Reviewer()
{
    editor.commands.addCommands([{
        name: 'refreshReviews',
        bindKey: {win: 'Alt-R',  mac: 'Option-R'},
        exec: function(editor) {
            refreshReviews();
        },
        readOnly: true
    },
    {
        name: 'nextReview',
        bindKey: {win: 'Alt-N',  mac: 'Option-N'},
        exec: function(editor) {
            nextReview();
        },
        readOnly: true
    },
    {
        name: 'previousReview',
        bindKey: {win: 'Alt-P',  mac: 'Option-P'},
        exec: function(editor) {
            previousReview();
        },
        readOnly: true
    },
    {
        name: 'deleteReview',
        bindKey: {win: 'Alt-D',  mac: 'Option-D'},
        exec: function(editor) {
            deleteReview();
        },
        readOnly: true
    },
    {
        name: 'createReview',
        bindKey: {win: 'Alt-C',  mac: 'Option-C'},
        exec: function(editor) {
            createReview();
        },
        readOnly: true
    },
    {
        name: 'askReviewer',
        bindKey: {win: 'Alt-R',  mac: 'Option-R'},
        exec: function(editor) {
            askReviewer();
        },
        readOnly: true
    }]);

    editor.setReadOnly(true);
    
    parts = document.URL.match(/\?review_uuid=([a-fA-F0-9-]{8}-[a-fA-F0-9-]{4}-[a-fA-F0-9-]{4}-[a-fA-F0-9-]{4}-[a-fA-F0-9-]{12})/)
    if (parts != null && parts[1] != null)
    {
        REV_UUID=parts[1];
        refreshReviews();
    }
}

function changeTheme(newTheme)
{
    ace.edit(EDITOR).setOption("theme", "ace/theme/" + newTheme);
}

// REVIEW LIST REFRESH
{
    function refreshReviews()
    {
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function() {
            var session = editor.getSession();
            var document = session.getDocument();

            document.setValue("");
            jval = JSON.parse(this.responseText);
            document.insertFullLines(0, jval.file_content.split(/\r?\n/));

            clearLocalReviews();

            let comments = jval.comments;

            for (let index in comments)
            {
                // console.log("_createReview console.log(comments[index]);");
                // console.log(comments[index]);
                _createReview(new ReviewComment(comments[index].reviewer, comments[index].fromrow, comments[index].fromcol, comments[index].torow, comments[index].tocol, comments[index].comment, comments[index].id));
            }

            session.setMode(MODELIST.getModeForPath(jval.file_name).mode);
            editor.clearSelection();
            editor.navigateFileStart();
        }
        xhttp.open("GET", "reviews/" + parts[1]);
        xhttp.send();
    }
}

// REVIEW CREATION
{
    function askReviewer()
    {
        var res = prompt("Who are you ?");
        if (res == null || res == "")
        {
            res = "???";
        }
        CUR_REVIEWER = res;
    }

    function _createReview(review)
    {
        // console.log("_createReview console.log(review);");
        // console.log(review);
        REVIEW_COMMENTS.set(review.id, review);
        var new_rev = document.getElementById("review_template").cloneNode(true);
        new_rev.id = review.id;
        new_rev.children[0].innerText = review.toString();
        REV_COMM_LIST.appendChild(new_rev);
        new_rev.style.display = '';
    }

    function createReview()
    {
        var editor = ace.edit(EDITOR);
        var range = editor.getSelectionRange();

        if (range.isEmpty())
        {
            alert('Some code have to be selected to create a review');
            return;
        }

        if (CUR_REVIEWER == "")
        {
            askReviewer();
        }

        var comment = prompt("Comment :");
        if (comment == null || comment == "")
        {
            alert("Empty comment. Discarded.")
            return;
        }

        var reviewComment = new ReviewComment(CUR_REVIEWER, range.start.row, range.start.column, range.end.row, range.end.column, comment);

        post_review_comment(reviewComment);
    }
}

// REVIEW DELETION
{
    function clearLocalReviews()
    {
        REVIEW_COMMENTS.clear();

        while (REV_COMM_LIST.firstChild)
        {
            REV_COMM_LIST.removeChild(REV_COMM_LIST.firstChild);
        }
        CUR_COMM_ELMT = null;
    }

    function deleteReview()
    {
        if (CUR_COMM_ELMT == null)
        {
            return;
        }

        delete_review_comment_by_id(CUR_COMM_ELMT.id);
        REVIEW_COMMENTS.delete(CUR_COMM_ELMT.id);

        REV_COMM_LIST.removeChild(CUR_COMM_ELMT);
        CUR_COMM_ELMT = null;

        ace.edit(EDITOR).clearSelection();
    }
}

// REVIEW BROWSING
{
    function nextReview()
    {
        if (!REV_COMM_LIST.hasChildNodes())
        {
            return;
        }

        if (CUR_COMM_ELMT == null || CUR_COMM_ELMT.nextSibling == null)
        {
            newElement = REV_COMM_LIST.firstChild;
        }
        else
        {
            newElement = CUR_COMM_ELMT.nextSibling;
        }

        selectReview(newElement);
    }

    function previousReview()
    {
        if (!REV_COMM_LIST.hasChildNodes())
        {
            return;
        }

        if (CUR_COMM_ELMT == null || CUR_COMM_ELMT.previousSibling == null)
        {
            previousElement = REV_COMM_LIST.lastChild;
        }
        else
        {
            previousElement = CUR_COMM_ELMT.previousSibling;
        }

        selectReview(previousElement);
    }

    function selectReview(htmlReviewComment)
    {
        if (htmlReviewComment == null)
        {
            return;
        }
        
        var editor = ace.edit(EDITOR);
        var range = editor.getSelectionRange();
        var select_color = 'w3-blue-grey';
        var unselect_color = 'w3-grey';

        if (CUR_COMM_ELMT != null)
        {
            CUR_COMM_ELMT.classList.remove(select_color);
            CUR_COMM_ELMT.classList.add(unselect_color);
        }

        CUR_COMM_ELMT = htmlReviewComment;
        // console.log("console.log(CUR_COMM_ELMT.id);");
        // console.log(CUR_COMM_ELMT.id);
        var reviewComment = REVIEW_COMMENTS.get(CUR_COMM_ELMT.id);
        // console.log("console.log(reviewComment);");
        // console.log(reviewComment);

        range.setStart(reviewComment.fromrow, reviewComment.fromcol);
        range.setEnd(reviewComment.torow, reviewComment.tocol);
        editor.getSession().getSelection().setSelectionRange(range);

        CUR_COMM_ELMT.classList.remove(unselect_color);
        CUR_COMM_ELMT.classList.add(select_color);
    }
}
