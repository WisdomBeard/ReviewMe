var EDITOR          = "editor";
var REVIEW_COMMENTS = [];
var CUR_REVIEWER    = "";
var REV_INDEX       = -1;
var REV_UUID        = "";
const URL_REGEX     = new RegExp('^(https?)(://)([^/:]+)(:[0-9]{1,5})?(/.*)?$');
var MODELIST        = ace.require("ace/ext/modelist");

// Upload

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

function post_review(review) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "reviews/"+REV_UUID+"/comments", true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send(JSON.stringify(review));
}

class ReviewComment
{
    static next_id = 0;

    constructor(_reviewer, _fromrow, _fromcol, _torow, _tocol, _comment, _id = undefined)
    {
        if (_id)
        {
            this.id = _id;
            ReviewComment.next_id = Math.max(ReviewComment.next_id, _id+1);
        }
        else
        {
            this.id = ReviewComment.next_id++;
        }
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
            deleteReview(REV_INDEX);
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

        const xhttp = new XMLHttpRequest();
        xhttp.onload = function() {
            var session = editor.getSession();
            var document = session.getDocument();

            document.setValue("");
            jval = JSON.parse(this.responseText);
            document.insertFullLines(0, jval.file_content.split(/\r?\n/));

            clearReviews();

            let reviews = jval.comments;

            for (let index in reviews)
            {
                _createReview(new ReviewComment(reviews[index].reviewer, reviews[index].fromrow, reviews[index].fromcol, reviews[index].torow, reviews[index].tocol, reviews[index].comment, reviews[index].id));
            }

            session.setMode(MODELIST.getModeForPath(jval.file_name).mode);
            editor.clearSelection();
            editor.navigateFileStart();
        }
        xhttp.open("GET", "reviews/" + parts[1]);
        xhttp.send();
    }
}

function changeTheme(newTheme)
{
    ace.edit(EDITOR).setOption("theme", "ace/theme/" + newTheme);
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
        REVIEW_COMMENTS.push(review);

        var new_rev = document.getElementById("review_template").cloneNode(true);
        new_rev.id = "rev_" + review.id;
        new_rev.children[0].innerText = review.toString();
        document.getElementById("review_list").appendChild(new_rev);
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

        var review = new ReviewComment(CUR_REVIEWER, range.start.row, range.start.column, range.end.row, range.end.column, comment);

        _createReview(review);

        post_review(review);
    }
}

// REVIEW DELETION
{
    function clearReviews()
    {
        REVIEW_COMMENTS = [];
        REV_INDEX = -1;

        var list = document.getElementById("review_list");
        while (list.firstChild)
        {
            list.removeChild(list.firstChild);
        }
    }

    function deleteReviewById(id)
    {
        var index = parseInt(id.slice(4));

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        deleteReview(index);
    }

    function deleteReview(index)
    {
        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        if (REV_INDEX >= 0 && REV_INDEX < REVIEW_COMMENTS.length)
        {
            document.getElementById('rev_'+REV_INDEX).classList.remove("w3-light-blue");
            document.getElementById('rev_'+REV_INDEX).classList.add("w3-blue-grey");
            REV_INDEX = -1;
        }

        REVIEW_COMMENTS.splice(index, 1);
        var rev = document.getElementById('rev_' + index);
        var list = rev.parentNode;
        list.removeChild(rev);
        ace.edit(EDITOR).clearSelection();

        for (var i = index ; i < REVIEW_COMMENTS.length ; i++)
        {
            list.children[i].id = "rev_" + i;
        }
    }
}

// REVIEW BROWSING
{
    function nextReview()
    {
        if (REVIEW_COMMENTS.length == 0)
        {
            return;
        }

        selectReview((REV_INDEX + 1) % REVIEW_COMMENTS.length);
    }

    function previousReview()
    {
        if (REVIEW_COMMENTS.length == 0)
        {
            return;
        }

        selectReview((REV_INDEX + REVIEW_COMMENTS.length - 1) % REVIEW_COMMENTS.length);
    }

    function selectReviewById(id)
    {
        var index = parseInt(id.slice(4));

        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        selectReview(index);
    }

    function selectReview(index)
    {
        if (index < 0 || index >= REVIEW_COMMENTS.length)
        {
            return;
        }

        var editor = ace.edit(EDITOR);
        var review  = REVIEW_COMMENTS[index];
        var range = editor.getSelectionRange();
        var select_color = 'w3-blue-grey';
        var unselect_color = 'w3-grey';

        if (REV_INDEX >= 0 && REV_INDEX < REVIEW_COMMENTS.length)
        {
            document.getElementById('rev_'+REV_INDEX).classList.remove(select_color);
            document.getElementById('rev_'+REV_INDEX).classList.add(unselect_color);
        }

        REV_INDEX = index;

        range.setStart(review.fromrow, review.fromcol);
        range.setEnd(review.torow, review.tocol);
        editor.getSession().getSelection().setSelectionRange(range);

        document.getElementById('rev_'+REV_INDEX).classList.remove(unselect_color);
        document.getElementById('rev_'+REV_INDEX).classList.add(select_color);
    }
}
