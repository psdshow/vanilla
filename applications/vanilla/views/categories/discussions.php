<?php if (!defined('APPLICATION')) exit();
echo '<h1 class="H HomepageTitle">'.$this->data('Title').'</h1>';
$ViewLocation = $this->fetchViewLocation('discussions', 'discussions');
if (c('Vanilla.EnableCategoryFollowing')) {
    echo '<div class="PageControls Top">';
    echo categoryFilters([['url' => 'http://google.ca', 'active' => true, 'name' => 'All'], ['url' => 'http://google.ca', 'name' => 'Following']]);
    echo '</div>';
}
?>
<div class="Categories">
    <?php foreach ($this->CategoryData->result() as $Category) :
        if ($Category->CategoryID <= 0)
            continue;

        $this->Category = $Category;
        $this->DiscussionData = $this->CategoryDiscussionData[$Category->CategoryID];

        if ($this->DiscussionData->numRows() > 0) : ?>

            <div class="CategoryBox Category-<?php echo $Category->UrlCode; ?>">
                <?php echo getOptions($Category); ?>
                <h2 class="H"><?php
                    echo anchor(htmlspecialchars($Category->Name), categoryUrl($Category));
                    Gdn::controller()->EventArguments['Category'] = $Category;
                    Gdn::controller()->fireEvent('AfterCategoryTitle');
                    ?></h2>

                <ul class="DataList Discussions">
                    <?php include($this->fetchViewLocation('discussions', 'discussions')); ?>
                </ul>

                <?php if ($this->DiscussionData->numRows() == $this->DiscussionsPerCategory) : ?>
                    <div class="MorePager">
                        <?php echo anchor(t('More Discussions'), '/categories/'.$Category->UrlCode); ?>
                    </div>
                <?php endif; ?>

            </div>

        <?php endif; ?>

    <?php endforeach; ?>
</div>
